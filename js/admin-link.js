// 허용된 IP에서만 메인 화면에 '관리자' 버튼을 보여준다.
// IP 목록은 이 파일에 넣지 않는다. Supabase의 admin_check()가 요청 IP를 보고 판단한다.
(() => {
  const links = document.querySelectorAll('[data-admin-link]');
  if (!links.length) return;

  const cfg = window.KW_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey) return;

  // supabase-js 의 sb.rpc('admin_check') 와 같은 REST 호출
  fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/admin_check', {
    method: 'POST',
    headers: {
      apikey: cfg.anonKey,
      Authorization: 'Bearer ' + cfg.anonKey,
      'Content-Type': 'application/json'
    },
    body: '{}',
    cache: 'no-store'
  })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('admin_check ' + r.status)))
    .then(d => {
      if (d && d.ip_allowed === true) links.forEach(a => { a.hidden = false; });
    })
    .catch(() => { /* 확인이 안 되면 버튼은 그대로 숨긴다 */ });
})();
