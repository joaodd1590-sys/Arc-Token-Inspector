// Background animated squares (subtle + ARC purple vibe)
// Note: This never blocks the main app even on mobile.

(() => {
  const canvas = document.getElementById("bg-squares");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });

  let w = 0, h = 0;
  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  // Disable on smaller screens (but do NOT crash the page)
  if (window.innerWidth < 768) {
    canvas.style.display = "none";
    return;
  }

  const mouse = { x: w / 2, y: h / 2 };
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  const SQUARES = 42;
  const INTERACTION_RADIUS = 180;

  function createSquare() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      size: 10 + Math.random() * 18,
      speedX: 0.35 + Math.random() * 0.55,
      speedY: -0.25 - Math.random() * 0.45,
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - 0.5) * 0.01,
      alpha: 0.10 + Math.random() * 0.14
    };
  }

  const squares = Array.from({ length: SQUARES }, createSquare);

  function draw() {
    ctx.clearRect(0, 0, w, h);

    for (const s of squares) {
      const dx = s.x - mouse.x;
      const dy = s.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

      let forceX = 0;
      let forceY = 0;

      if (dist < INTERACTION_RADIUS) {
        const strength = (INTERACTION_RADIUS - dist) / INTERACTION_RADIUS;
        forceX = (dx / dist) * strength * 1.15;
        forceY = (dy / dist) * strength * 1.15;
      }

      s.x += s.speedX + forceX;
      s.y += s.speedY + forceY;
      s.rotation += s.rotationSpeed;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);

      // ARC purple (transparent)
      ctx.fillStyle = `rgba(124, 58, 237, ${s.alpha})`;
      ctx.shadowColor = "rgba(124, 58, 237, 0.35)";
      ctx.shadowBlur = 14;

      ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
      ctx.restore();

      // Respawn if off screen
      if (s.x > w + 60 || s.y < -60 || s.x < -60 || s.y > h + 60) {
        const ns = createSquare();
        Object.assign(s, ns);
        s.x = Math.random() * w;
        s.y = h + 40;
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
})();
