/* 메인 히어로: 마우스가 지나가는 자리의 그물망이 걷히고, 그 뒤에 깔린 양말 사진이 드러나는 효과.
   지나간 자국은 천천히 다시 덮입니다. 모바일은 손가락으로 쓸면 동작하고,
   입력이 없으면 가끔 자동으로 한 줄기 흘러가며 보여 줍니다.
   움직임 줄이기 설정을 켠 기기에서는 동작하지 않습니다. */
(function () {
  var hero = document.querySelector('.hero');
  if (!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none';
  var knit = document.getElementById('knit');
  if (knit && knit.nextSibling) hero.insertBefore(cv, knit.nextSibling); else hero.prepend(cv);
  var ctx = cv.getContext('2d');

  // 마스크(드러난 영역)는 절반 해상도로 계산해 가볍게 유지
  var mk = document.createElement('canvas'), mctx = mk.getContext('2d');
  var MS = 0.5, W = 0, H = 0, dpr = 1;

  var img = new Image(), ready = false;
  img.onload = function () { ready = true; };
  img.src = 'images/socks.jpg?v=20261126';

  function size() {
    var r = hero.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    mk.width = Math.round(W * MS); mk.height = Math.round(H * MS);
  }
  size();
  addEventListener('resize', size);

  var pts = [], last = null, running = false, quiet = 0, px = 0.5, py = 0.5;

  function stamp(x, y, rad) {
    var g = mctx.createRadialGradient(x * MS, y * MS, 0, x * MS, y * MS, rad * MS);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = g;
    mctx.beginPath(); mctx.arc(x * MS, y * MS, rad * MS, 0, Math.PI * 2); mctx.fill();
  }

  function add(x, y) {
    var base = W < 700 ? 42 : 85;
    if (last) {
      var dx = x - last.x, dy = y - last.y, d = Math.hypot(dx, dy);
      var rad = base + Math.min(W < 700 ? 18 : 35, d * 0.3);           // 빠르게 움직일수록 더 넓게
      var n = Math.max(1, Math.ceil(d / (rad * 0.25)));  // 끊기지 않게 사이를 채움
      for (var i = 1; i <= n; i++) pts.push([last.x + dx * i / n, last.y + dy * i / n, rad]);
    } else pts.push([x, y, base]);
    last = { x: x, y: y };
    px = x / W; py = y / H;
    quiet = 0;
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function drawCover() {
    // 사진을 화면에 꽉 차게 깔고, 커서 방향으로 살짝 움직여 깊이감을 줌
    var s = Math.max(cv.width / img.width, cv.height / img.height) * 1.08;
    var w = img.width * s, h = img.height * s;
    var ox = (cv.width - w) / 2 - (px - 0.5) * (w - cv.width);
    var oy = (cv.height - h) / 2 - (py - 0.5) * (h - cv.height);
    ctx.drawImage(img, ox, oy, w, h);
  }

  function tick() {
    // 지나간 자국이 천천히 다시 덮이도록 마스크를 조금씩 지움
    mctx.globalCompositeOperation = 'destination-out';
    mctx.fillStyle = 'rgba(0,0,0,.025)';
    mctx.fillRect(0, 0, mk.width, mk.height);
    mctx.globalCompositeOperation = 'source-over';
    while (pts.length) { var p = pts.shift(); stamp(p[0], p[1], p[2]); }

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (ready) {
      drawCover();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mk, 0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'source-over';
    }
    quiet++;
    if (quiet < 150) requestAnimationFrame(tick);   // 약 2.5초 동안 입력이 없으면 멈춤
    else { running = false; mctx.clearRect(0, 0, mk.width, mk.height); ctx.clearRect(0, 0, cv.width, cv.height); }
  }

  function at(cx, cy) {
    var r = hero.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    if (x < 0 || y < 0 || x > r.width || y > r.height) { last = null; return; }
    user(); add(x, y);
  }
  hero.addEventListener('mousemove', function (e) { at(e.clientX, e.clientY); });
  hero.addEventListener('mouseleave', function () { last = null; });
  hero.addEventListener('touchstart', function (e) { last = null; var t = e.touches[0]; at(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener('touchmove', function (e) { var t = e.touches[0]; at(t.clientX, t.clientY); }, { passive: true });

  // 입력이 없을 때 가끔 화면을 가로지르며 자동으로 보여 줌
  var idle = 0, auto = 0, inView = true;
  function user() { auto = 0; clearTimeout(idle); idle = setTimeout(startAuto, 5000); }
  function startAuto() {
    if (!inView || document.hidden) { idle = setTimeout(startAuto, 3000); return; }
    var t0 = performance.now(), dur = 3200, dir = Math.random() < 0.5 ? 1 : -1, id = ++auto;
    // 캔버스 y는 아래로 갈수록 커지므로, 화면 아래쪽에서 출발해 위쪽에서 끝나는 상승 곡선으로 그립니다.
    // 가운데가 살짝 처지는 완만한 활 모양이라 끝까지 기울기가 위를 향하고, 좌우 어느 방향이어도 같습니다.
    var yStart = 0.68 + Math.random() * 0.10;
    var yEnd = 0.24 + Math.random() * 0.10;
    var bow = 0.08 + Math.random() * 0.04;
    last = null;
    (function step(now) {
      if (auto !== id) return;
      var p = Math.min(1, (now - t0) / dur), e = p * p * (3 - 2 * p);
      var x = W * (dir > 0 ? -0.05 + e * 1.1 : 1.05 - e * 1.1);
      var y = H * (yStart + (yEnd - yStart) * e + Math.sin(e * Math.PI) * bow);
      add(x, y);
      if (p < 1) requestAnimationFrame(step); else { auto = 0; last = null; idle = setTimeout(startAuto, 6000); }
    })(t0);
  }
  if ('IntersectionObserver' in window)
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (!inView) auto = 0; }).observe(hero);
  idle = setTimeout(startAuto, 1400);
})();
