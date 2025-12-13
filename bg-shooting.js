const canvas = document.getElementById("bg-shooting");
const ctx = canvas.getContext("2d");

let w, h;
function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// Desativa no mobile
if (window.innerWidth < 768) {
  canvas.style.display = "none";
  throw new Error("Mobile disabled");
}

// Mouse (influência leve)
const mouse = { x: w / 2, y: h / 2 };
window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// Config
const STAR_COUNT = 25;
const stars = [];

function createStar() {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    len: 80 + Math.random() * 120,
    speed: 3 + Math.random() * 6,
    alpha: 0.4 + Math.random() * 0.6,
    angle: Math.PI * 0.65 
  };
}

for (let i = 0; i < STAR_COUNT; i++) {
  stars.push(createStar());
}

function draw() {
  ctx.clearRect(0, 0, w, h);

  stars.forEach(s => {
    const dx = Math.cos(s.angle) * s.len;
    const dy = Math.sin(s.angle) * s.len;

    ctx.strokeStyle = `rgba(56, 189, 248, ${s.alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - dx, s.y - dy);
    ctx.stroke();

    // Movimento
    s.x += Math.cos(s.angle) * s.speed;
    s.y += Math.sin(s.angle) * s.speed;

    // Interação suave com mouse
    s.x += (mouse.x - w / 2) * 0.0003;
    s.y += (mouse.y - h / 2) * 0.0003;

    // Reset
    if (s.x > w + 200 || s.y > h + 200) {
      Object.assign(s, createStar());
      s.x = Math.random() * w * 0.3;
      s.y = -100;
    }
  });

  requestAnimationFrame(draw);
}

draw();
