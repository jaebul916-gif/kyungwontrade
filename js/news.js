// PRESS > 뉴스: Supabase에서 목록을 읽어 그리고, 누르면 상세 내용을 보여준다.
// 뉴스는 Supabase에 저장되며 관리자 페이지(admin/)에서 쓰고 고친다.
(() => {
  const list = document.querySelector('#press-news .news');
  if (!list) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = d => String(d || '').replace(/-/g, '.');
  const excerpt = t => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > 140 ? s.slice(0, 140) + '…' : s; };
  const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
  // 영문 페이지(<html lang="en">)는 영문 제목·내용이 있으면 그것을 쓴다
  const EN = (document.documentElement.lang || '').startsWith('en');
  const T = EN ? { close: 'Close', link: 'Read the original article ↗' } : { close: '닫기', link: '원문 기사 보기 ↗' };
  const tx = n => ({ ...n, title: (EN && n.title_en) || n.title, body: (EN && n.body_en) || n.body });

  // 상세 보기 창
  const dlg = document.createElement('dialog');
  dlg.className = 'news-dlg';
  dlg.innerHTML = '<button class="nd-close" type="button" aria-label="' + T.close + '">×</button><figure class="nd-img"><img alt=""></figure><div class="nd-txt"><time></time><h3></h3><div class="nd-body"></div><a class="nd-link" target="_blank" rel="noopener">' + T.link + '</a></div>';
  document.body.appendChild(dlg);
  dlg.querySelector('.nd-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  let items = [];
  function open(i) {
    const n = items[i]; if (!n) return;
    const fig = dlg.querySelector('.nd-img'), img = fig.querySelector('img');
    fig.hidden = !n.image; if (n.image) { img.src = n.image; img.alt = n.title; }
    dlg.querySelector('time').textContent = fmt(n.date);
    dlg.querySelector('h3').textContent = n.title;
    dlg.querySelector('.nd-body').textContent = n.body || '';
    const a = dlg.querySelector('.nd-link'), url = safeUrl(n.link);
    a.hidden = !url; if (url) a.href = url;
    dlg.showModal();
  }

  function render(data) {
    items = data.map(tx).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    list.innerHTML = items.map((n, i) => `<li><button class="row" type="button" data-i="${i}">` +
      (n.image ? `<figure class="thumb"><img src="${esc(n.image)}" alt="${esc(n.title)}" loading="lazy" decoding="async"></figure>` : '<figure class="thumb"></figure>') +
      `<div class="txt"><time>${esc(fmt(n.date))}</time><b>${esc(n.title)}</b><p>${esc(excerpt(n.body))}</p></div><span class="arw" aria-hidden="true">→</span></button></li>`).join('');
  }
  list.addEventListener('click', e => { const b = e.target.closest('button.row'); if (b) open(+b.dataset.i); });

  // Supabase news 테이블에서 읽는다. 설정이 비어 있거나 실패하면 HTML 목록을 그대로 둔다.
  const cfg = window.KW_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey) return;
  fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/news?select=id,date,title,body,title_en,body_en,image,link&order=date.desc,id.desc',
    { headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey }, cache: 'no-store' })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(d => { if (Array.isArray(d) && d.length) render(d); })
    .catch(() => {});
})();
