/* 메인 히어로: 마우스를 움직이면 양말 사진 조각이 커서를 따라 나타났다 사라지는 효과.
   데스크톱은 마우스, 모바일은 터치로 동작하고, 입력이 없으면 자동으로 한 번씩 흘러갑니다.
   움직임 줄이기 설정을 켠 사용자에게는 동작하지 않습니다. */
(function () {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SRC = 'images/socks.jpg', IW = 602, IH = 402;
  var css = document.createElement('style');
  css.textContent =
    '.sock-trail{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}' +
    '.sock-tile{position:absolute;left:0;top:0;border-radius:14px;background-repeat:no-repeat;' +
    'box-shadow:0 18px 40px -18px rgba(0,0,0,.45);will-change:transform,opacity;opacity:0}';
  document.head.appendChild(css);

  var layer = document.createElement('div');
  layer.className = 'sock-trail';
  layer.setAttribute('aria-hidden', 'true');
  var knit = document.getElementById('knit');
  if (knit && knit.nextSibling) hero.insertBefore(layer, knit.nextSibling); else hero.prepend(layer);

  var img = new Image(); img.src = SRC; // 미리 불러오기

  var MAX = 14, GAP = 90, tiles = [], last = null, idle = null, auto = 0, autoT = 0, inView = true;
  var small = function () { return innerWidth < 700; };

  function spawn(x, y, dx, dy) {
    var w = (small() ? 120 : 180) + Math.random() * (small() ? 40 : 70);
    var h = w * 1.25;
    var k = (w / IW) * (2 + Math.random() * 0.6); // 사진의 일부만 크롭해서 보여줌
    var bw = IW * k, bh = IH * k;
    if (bh < h) { k = h / IH * 1.05; bw = IW * k; bh = IH * k; }
    var t = document.createElement('div');
    t.className = 'sock-tile';
    t.style.width = w + 'px';
    t.style.height = h + 'px';
    t.style.backgroundImage = 'url(' + SRC + ')';
    t.style.backgroundSize = bw + 'px ' + bh + 'px';
    t.style.backgroundPosition = -(Math.random() * (bw - w)) + 'px ' + -(Math.random() * (bh - h)) + 'px';
    layer.appendChild(t);
    tiles.push(t);
    if (tiles.length > MAX) tiles.shift().remove();

    var rot = (Math.random() - 0.5) * 16;
    var x0 = x - w / 2, y0 = y - h / 2;
    var push = Math.min(60, Math.hypot(dx, dy)) / Math.max(1, Math.hypot(dx, dy));
    var a = t.animate([
      { opacity: 0, transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(.55) rotate(' + (rot - 8) + 'deg)' },
      { opacity: 1, transform: 'translate(' + (x0 + dx * push * .4) + 'px,' + (y0 + dy * push * .4) + 'px) scale(1) rotate(' + rot + 'deg)', offset: 0.25 },
      { opacity: 1, transform: 'translate(' + (x0 + dx * push * .6) + 'px,' + (y0 + dy * push * .6) + 'px) scale(1) rotate(' + rot + 'deg)', offset: 0.7 },
      { opacity: 0, transform: 'translate(' + (x0 + dx * push * .7) + 'px,' + (y0 + dy * push * .7 + 30) + 'px) scale(.8) rotate(' + (rot + 4) + 'deg)' }
    ], { duration: 1500, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
    a.onfinish = function () { t.remove(); var i = tiles.indexOf(t); if (i > -1) tiles.splice(i, 1); };
  }

  function move(cx, cy) {
    var r = hero.getBoundingClientRect();
    var x = cx - r.left, y = cy - r.top;
    if (y < 0 || y > r.height) return;
    if (!last) { last = { x: x, y: y }; return; }
    var dx = x - last.x, dy = y - last.y;
    if (Math.hypot(dx, dy) >= GAP) { spawn(x, y, dx, dy); last = { x: x, y: y }; }
  }

  function user() { stopAuto(); clearTimeout(idle); idle = setTimeout(startAuto, 4000); }

  hero.addEventListener('mousemove', function (e) { user(); move(e.clientX, e.clientY); });
  hero.addEventListener('mouseleave', function () { last = null; });
  hero.addEventListener('touchstart', function (e) { user(); last = null; var p = e.touches[0]; move(p.clientX, p.clientY); }, { passive: true });
  hero.addEventListener('touchmove', function (e) { user(); var p = e.touches[0]; move(p.clientX, p.clientY); }, { passive: true });

  // 입력이 없을 때: 화면을 가로지르는 곡선을 따라 자동으로 한 번 흘려 보냄
  function startAuto() {
    if (auto || !inView || document.hidden) { idle = setTimeout(startAuto, 4000); return; }
    var r = hero.getBoundingClientRect(), t0 = performance.now(), dur = 2600, prev = null;
    var dir = Math.random() < 0.5 ? 1 : -1, yb = 0.35 + Math.random() * 0.3;
    last = null;
    function step(now) {
      var p = (now - t0) / dur;
      if (p > 1 || !auto) { auto = 0; last = null; idle = setTimeout(startAuto, 5000); return; }
      var x = r.width * (dir > 0 ? -0.05 + p * 1.1 : 1.05 - p * 1.1);
      var y = r.height * (yb + Math.sin(p * Math.PI * 2) * 0.18);
      if (!prev || Math.hypot(x - prev.x, y - prev.y) >= GAP * 1.2) {
        spawn(x, y, prev ? x - prev.x : 0, prev ? y - prev.y : 0); prev = { x: x, y: y };
      }
      autoT = requestAnimationFrame(step);
    }
    auto = 1; autoT = requestAnimationFrame(step);
  }
  function stopAuto() { if (auto) { auto = 0; cancelAnimationFrame(autoT); last = null; } }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (!inView) stopAuto(); }).observe(hero);
  }
  idle = setTimeout(startAuto, 1600);
})();
