const canvas = document.getElementById("bg-squares");
const ctx = canvas.getContext("2d");

let w, h;
function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// Desativa no mobile (opcional)
if (window.innerWidth < 768) {
  canvas.style.display = "none";
  throw new Error("Mobile disabled");
}

// Mouse
const mouse = { x: w / 2, y: h / 2 };
window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// Config
const SQUARES = 35;
const squares = [];

function createSquare() {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: 8 + Math.random() * 18,
    speed: 0.3 + Math.random() * 0.6,
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - 0.5) * 0.01,
    alpha: 0.15 + Math.random() * 0.25
  };
}

for (let i = 0; i < SQUARES; i++) {
  squares.push(createSquare());
}

function draw() {
  ctx.clearRect(0, 0, w, h);

  squares.forEach(s => {
    ctx.save();

    ctx.translate(s.x, s.y);
    ctx.rotate(s.rotation);

    ctx.fillStyle = `rgba(0, 168, 255, ${s.alpha})`;
    ctx.shadowColor = "rgba(0,168,255,0.6)";
    ctx.shadowBlur = 12;

    ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);

    ctx.restore();

    // Movimento diagonal suave
    s.x += s.speed;
    s.y -= s.speed * 0.6;

    // Rotação
    s.rotation += s.rotationSpeed;

    // Interação leve com mouse
    s.x += (mouse.x - w / 2) * 0.00005;
    s.y += (mouse.y - h / 2) * 0.00005;

    // Reset
    if (s.x > w + 50 || s.y < -50) {
      Object.assign(s, createSquare());
      s.x = -20;
      s.y = Math.random() * h;
    }
  });

  requestAnimationFrame(draw);
}

draw();
