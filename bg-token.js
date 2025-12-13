const canvas = document.getElementById("bg-aura");
const ctx = canvas.getContext("2d");

let w, h;
function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// 🔮 Mouse
const mouse = { x: w / 2, y: h / 2 };
window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// 🟣 Aura circles
const AURA_COUNT = 3;
const auras = [];

for (let i = 0; i < AURA_COUNT; i++) {
  auras.push({
    x: Math.random() * w,
    y: Math.random() * h,
    radius: 260 + Math.random() * 180,
    phase: Math.random() * Math.PI * 2,
    speed: 0.003 + Math.random() * 0.002
  });
}

function draw() {
  ctx.clearRect(0, 0, w, h);

  auras.forEach(aura => {
    aura.phase += aura.speed;

    const pulse = Math.sin(aura.phase) * 20;
    const dx = (mouse.x - w / 2) * 0.015;
    const dy = (mouse.y - h / 2) * 0.015;

    const x = aura.x + dx;
    const y = aura.y + dy;
    const r = aura.radius + pulse;

    const gradient = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    gradient.addColorStop(0, "rgba(168, 85, 247, 0.18)");
    gradient.addColorStop(0.5, "rgba(168, 85, 247, 0.10)");
    gradient.addColorStop(1, "rgba(168, 85, 247, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  requestAnimationFrame(draw);
}

draw();
