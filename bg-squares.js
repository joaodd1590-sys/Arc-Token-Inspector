const canvas = document.getElementById("bg-squares");
if (canvas) {
  const ctx = canvas.getContext("2d");

  let w = 0, h = 0;
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  const squares = Array.from({ length: 28 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    s: 10 + Math.random() * 18,
    vx: 0.15 + Math.random() * 0.35,
    vy: -0.1 - Math.random() * 0.25,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.01,
    a: 0.06 + Math.random() * 0.09
  }));

  function tick() {
    ctx.clearRect(0, 0, w, h);

    for (const p of squares) {
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = `rgba(124, 58, 237, ${p.a})`;
      ctx.shadowColor = "rgba(124, 58, 237, 0.25)";
      ctx.shadowBlur = 14;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
      ctx.restore();

      if (p.x > w + 60 || p.y < -60) {
        p.x = -40;
        p.y = h + 40;
      }
    }

    requestAnimationFrame(tick);
  }

  tick();
}
