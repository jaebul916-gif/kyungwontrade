-- =====================================================================
-- 경원상사 홈페이지 뉴스 · Supabase 설정
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하면 됩니다. (한 번만)
-- =====================================================================

-- 1) 뉴스 테이블
create table if not exists public.news (
  id         bigint generated always as identity primary key,
  date       date not null,                                   -- 게시일
  title      text not null check (char_length(title) between 1 and 200),
  body       text not null default '',                        -- 내용
  image      text,                                            -- 대표이미지 주소
  link       text,                                            -- 원문 기사 링크 (선택)
  title_en   text,                                            -- 영문 제목 (선택, 영문 페이지용)
  body_en    text,                                            -- 영문 내용 (선택, 영문 페이지용)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 예전에 이 파일을 실행했던 경우를 위해 영문 칸 추가
alter table public.news add column if not exists title_en text;
alter table public.news add column if not exists body_en text;

create index if not exists news_date_idx on public.news (date desc, id desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists news_touch on public.news;
create trigger news_touch before update on public.news for each row execute function public.touch_updated_at();

-- 2) 관리자 접속 허용 IP (나중에 IP가 바뀌면 Table Editor > admin_ips 에서 수정)
create table if not exists public.admin_ips (
  ip   inet primary key,
  memo text
);
insert into public.admin_ips (ip, memo) values
  ('61.73.77.236', '관리자 PC 1'),
  ('1.217.102.90', '관리자 PC 2')
on conflict do nothing;

-- 3) 관리자 계정 목록 (Authentication 에서 만든 사용자 중 관리자만 등록)
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  memo    text
);

-- 4) 요청을 보낸 IP와 관리자 여부 판단
create or replace function public.request_ip() returns inet
language sql stable as $$
  select nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1)), '')::inet
$$;

create or replace function public.is_admin_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

create or replace function public.ip_allowed() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_ips where ip = public.request_ip())
$$;

-- 관리자 = 등록된 계정 + 허용된 IP 둘 다 만족
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin_user() and public.ip_allowed()
$$;

-- 관리자 페이지가 접속 상태를 확인할 때 쓰는 함수
create or replace function public.admin_check() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('ip', host(public.request_ip()), 'ip_allowed', public.ip_allowed(), 'is_admin', public.is_admin_user())
$$;
grant execute on function public.admin_check() to anon, authenticated;

-- 5) 권한(RLS): 누구나 읽기, 쓰기는 허용 IP의 관리자만
alter table public.news      enable row level security;
alter table public.admin_ips enable row level security;   -- 정책 없음 = API로 접근 불가
alter table public.admins    enable row level security;   -- 정책 없음 = API로 접근 불가

drop policy if exists "news read"   on public.news;
drop policy if exists "news insert" on public.news;
drop policy if exists "news update" on public.news;
drop policy if exists "news delete" on public.news;
create policy "news read"   on public.news for select using (true);
create policy "news insert" on public.news for insert to authenticated with check (public.is_admin());
create policy "news update" on public.news for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "news delete" on public.news for delete to authenticated using (public.is_admin());

-- 5-1) API 권한 (새 Supabase 프로젝트는 표를 자동으로 API에 열어주지 않으므로 직접 부여)
grant usage on schema public to anon, authenticated;
grant select on public.news to anon, authenticated;
grant insert, update, delete on public.news to authenticated;
grant execute on function public.admin_check(), public.is_admin(), public.is_admin_user(), public.ip_allowed(), public.request_ip() to anon, authenticated;

-- 6) 대표이미지 저장소 (공개 읽기, 관리자만 올리기/지우기, 5MB 이하 이미지)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news', 'news', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "news images insert" on storage.objects;
drop policy if exists "news images update" on storage.objects;
drop policy if exists "news images delete" on storage.objects;
create policy "news images insert" on storage.objects for insert to authenticated with check (bucket_id = 'news' and public.is_admin_user());
create policy "news images update" on storage.objects for update to authenticated using (bucket_id = 'news' and public.is_admin_user());
create policy "news images delete" on storage.objects for delete to authenticated using (bucket_id = 'news' and public.is_admin_user());

-- 7) 기존 홈페이지 뉴스 12건 (테이블이 비어 있을 때만 넣음)
insert into public.news (date, title, body, image, link)
select v.date::date, v.title, v.body, v.image, v.link from (values
  ('2014-11-11', '[제 28회 섬유의 날] 국무총리상 수상', '제 28회 섬유의 날을 맞아 박중근 대표가 적극적인 신제품 개발과 해외영업으로 국내 섬유패션산업의 글로벌 위상을 강화시켜 국무총리상을 수상했다.', 'images/press-12.jpg', 'http://www.itnk.co.kr/news/articleView.html?idxno=44225'),
  ('2014-12-25', '어려운 이웃에 사랑 나눔', '경원상사가 24일 익산시청을 통해 양말 5000켤레와 성금 300만원을 기탁하여 지역사회의 귀감이 되고 있다.', 'images/press-11.jpg', 'http://www.gukjenews.com/news/articleView.html?idxno=182163'),
  ('2015-09-01', '2015 대한민국경영혁신대상 수상', '경영혁신을 통해 기업 경쟁력을 확보하고 국가산업 발전과 사회에 공헌한 기업으로 선정되어 대한민국 경영혁신대상을 수상하였다.', 'images/press-10.jpg', null),
  ('2015-12-07', '[제 52회 무역의 날] 5백만불탑 수상', '수출 5백만불을 달성한 경원상사가 제 52회 무역의 날을 맞이하여 수출의 탑을 수상하였다.', 'images/press-09.jpg', 'http://weeklytrade.co.kr/news/view.html?section=1&category=3&item=&no=12971'),
  ('2016-09-28', '익산시 우수향토기업 인증서 수여', '경영 및 기술품질 평가, 기업성장 잠재력, 지역사회 발전 기여도 등에 우수함을 인정받아 익산시 우수향토기업에 수여되었다.', 'images/press-08.jpg', 'http://www.newsmaker.or.kr/news/articleView.html?idxno=32503'),
  ('2016-11-07', '기술혁신형 중소기업(INNO-BIZ) 확인서 취득', '기술혁신형 중소기업임을 입증받아 중소기업청으로부터 INNO-BIZ 확인서를 취득하였다.', 'images/press-07.jpg', null),
  ('2017-06-26', '한지양말 및 그 제조 방법에 대한 특허 취득', '닥나무 소재로 만들어진 한지사로 제작된 양말에 대한 기능 및 발명을 인정받아 특허번호 제 10-1752712호를 취득하였다.', 'images/press-06.jpg', null),
  ('2017-10-16', '전라북도 유망중소기업 인증서 수여', '경원상사가 도내에 소재한 중소 및 벤처기업 중 성장 잠재력이 높고 기술력이 뛰어난 중소기업으로 선정되어 인증서를 수여 받았다.', 'images/press-05.jpg', 'http://www.joongdo.co.kr/main/view.php?key=20171017010004482'),
  ('2017-11-13', '저소득층 지원을 위한 성금 및 물품 기탁', '경원상사가 13일 익산행복나눔마켓뱅크에 양말 6000켤레와 성금 300만원을 기탁하여 지역사회 나눔에 귀감이 되고 있다.', 'images/press-04.jpg', 'http://www.jeollailbo.com/news/articleView.html?idxno=526168'),
  ('2018-07-20', '서울지사 사무실 이전', '서초구 방배동에 위치했던 서울지사 사무실이 2018년 7월 20일부로 서초동 중산빌딩으로 이전했다고 밝혔다.', 'images/press-03.jpg', null),
  ('2019-04-18', '윤리적인 제조에 대한 WRAP 인증 취득', '경원상사가 세계적인 공신력을 가진 WRAP(Worldwide Responsible Accredited Production)으로부터 합법적이고 윤리적인 제조를 인정받아 인증서를 취득했다고 밝혔다.', 'images/press-02.jpg', null),
  ('2019-12-02', '경원의 자체 브랜드 KLAVA 판매 시작', '경원의 자체 브랜드 KLAVA가 크라우드 펀딩 플랫폼 와디즈를 통해 2019년 12월 11일 본격 런칭한다.', 'images/press-01.jpg', null)
) as v(date, title, body, image, link)
where not exists (select 1 from public.news);

-- 기존 뉴스 12건의 영문 제목·내용 (기존 영문 페이지 문구)
update public.news set title_en = 'KLAVA, our own brand, goes on sale', body_en = 'Kyungwon’s own brand KLAVA launches on the crowdfunding platform Wadiz on 11 December 2019.' where image = 'images/press-01.jpg' and title_en is null;
update public.news set title_en = 'WRAP certification for ethical manufacturing', body_en = 'Kyungwon was recognised for lawful and ethical manufacturing by WRAP (Worldwide Responsible Accredited Production).' where image = 'images/press-02.jpg' and title_en is null;
update public.news set title_en = 'Seoul office moved', body_en = 'The Seoul office moved from Bangbae-dong, Seocho-gu to Jungsan Building in Seocho-dong as of 20 July 2018.' where image = 'images/press-03.jpg' and title_en is null;
update public.news set title_en = 'Donation for low-income neighbours', body_en = 'Kyungwon donated 6,000 pairs of socks and 3 million won to the Iksan Happiness Sharing Market Bank.' where image = 'images/press-04.jpg' and title_en is null;
update public.news set title_en = 'Jeollabuk-do promising small business certificate', body_en = 'Selected among the province’s SMEs with high growth potential and strong technology.' where image = 'images/press-05.jpg' and title_en is null;
update public.news set title_en = 'Patent for Hanji socks and their manufacturing method', body_en = 'Recognised for the function and invention of socks made with Hanji yarn from paper mulberry bark — Patent No. 10-1752712.' where image = 'images/press-06.jpg' and title_en is null;
update public.news set title_en = 'INNO-BIZ certificate', body_en = 'Certified as a technology-innovative SME by the Small and Medium Business Administration.' where image = 'images/press-07.jpg' and title_en is null;
update public.news set title_en = 'Iksan excellent local company certificate', body_en = 'Recognised for management, technology and quality, growth potential and contribution to the local community.' where image = 'images/press-08.jpg' and title_en is null;
update public.news set title_en = '$5 million export tower on the 52nd Trade Day', body_en = 'Kyungwon received the export tower for reaching $5 million in exports.' where image = 'images/press-09.jpg' and title_en is null;
update public.news set title_en = '2015 Korea Management Innovation Award', body_en = 'Awarded for securing competitiveness through management innovation and contributing to national industry and society.' where image = 'images/press-10.jpg' and title_en is null;
update public.news set title_en = 'Sharing with neighbours in need', body_en = 'Kyungwon donated 5,000 pairs of socks and 3 million won through Iksan City Hall.' where image = 'images/press-11.jpg' and title_en is null;
update public.news set title_en = 'Prime Minister’s Award on the 28th Textile Day', body_en = 'CEO J.K. Park received the Prime Minister’s Award for new product development and overseas sales that raised the global standing of Korean textiles.' where image = 'images/press-12.jpg' and title_en is null;

-- =====================================================================
-- 8) 관리자 등록 (위를 실행한 뒤, 따로 한 번 실행)
--    먼저 Authentication > Users > Add user 로 관리자 이메일/비밀번호를 만들고
--    아래 이메일을 바꿔서 실행하세요.
-- =====================================================================
-- insert into public.admins (user_id, memo)
-- select id, '관리자' from auth.users where email = '관리자이메일@example.com';
