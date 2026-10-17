(function () {
  if (!/[?&]perf=1/.test(location.search)) return;
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:99999;font:600 12px sans-serif;color:#F4DDB0;background:rgba(5,6,10,.85);padding:4px 8px;border-radius:10px;display:flex;gap:6px;align-items:center;pointer-events:auto';
  const t = document.createElement('span'); t.style.minWidth = '92px'; d.appendChild(t);
  const layers = [['Sky', '^bhSkyQuad$'], ['Planets', 'Vista|planet|atmo|moon'], ['Fx', '^dust$|^fx']];
  layers.forEach(function (L) {
    const b = document.createElement('button'); b.textContent = L[0]; let on = true;
    b.style.cssText = 'min-width:44px;height:30px;border-radius:8px;border:1px solid #E8A857;background:#1a1208;color:#F4DDB0;font:600 12px sans-serif';
    b.onclick = function () {
      on = !on; b.style.opacity = on ? 1 : 0.4;
      const re = new RegExp(L[1], 'i');
      window.__bh.scene.meshes.forEach(function (m) { if (re.test(m.name)) m.isVisible = on; });
    };
    d.appendChild(b);
  });
  document.body.appendChild(d);
  let last = performance.now(), ema = 16;
  (function tick(now) { ema += ((now - last) - ema) * 0.08; last = now; t.textContent = ema.toFixed(1) + ' ms  ' + (1000 / ema).toFixed(0) + ' fps'; requestAnimationFrame(tick); })(last);
})();
