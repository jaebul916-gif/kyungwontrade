# 경원상사 홈페이지

(주)경원상사 홈페이지 리디자인. 빌드 과정 없는 정적 사이트(HTML/CSS/JS)입니다.

- `index.html`: 사이트 전체 (스크롤 애니메이션은 GSAP, Lenis를 CDN으로 불러옵니다)
- `images/`: 대표 사진, 서명, 인증서 이미지

모든 경로가 상대 경로라 GitHub Pages의 `/kyungwontrade/` 경로에서도 그대로 동작합니다.
GitHub Pages: Settings → Pages → Branch `main` / `(root)` 선택.

## 뉴스 관리 (Supabase)

PRESS > 뉴스는 Supabase `news` 테이블에서 읽어 옵니다. 관리자 페이지: `/admin/`

처음 한 번 설정:
1. Supabase 대시보드 > SQL Editor 에서 `supabase/setup.sql` 전체 실행 (테이블, 권한, 이미지 저장소, 기존 뉴스 12건)
2. Authentication > Users > Add user 로 관리자 계정 생성 후, `setup.sql` 맨 아래 8) 의 SQL로 관리자 등록
3. Authentication > Sign In / Providers 에서 "Allow new users to sign up" 끄기
4. `js/supabase-config.js` 에 Project URL 과 anon(public) key 입력

관리자 허용 IP 변경: Table Editor > `admin_ips` 표에서 IP 수정·추가.
글쓰기·수정·삭제는 서버(DB 권한)에서 "등록된 관리자 계정 + 허용 IP" 둘 다 맞을 때만 됩니다.
