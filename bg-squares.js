const canvas = document.getElementById("bg-squares");
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

// Mouse
const mouse = {
  x: w / 2,
  y: h / 2
};

window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// Configuração
const SQUARES = 40;
const squares = [];
const INTERACTION_RADIUS = 180;

function createSquare() {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: 10 + Math.random() * 18,
    speedX: 0.4 + Math.random() * 0.6,
    speedY: -0.3 - Math.random() * 0.5,
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - 0.5) * 0.01,
    alpha: 0.18 + Math.random() * 0.22
  };
}

for (let i = 0; i < SQUARES; i++) {
  squares.push(createSquare());
}

function draw() {
  ctx.clearRect(0, 0, w, h);

  squares.forEach(s => {
    // Distância até o mouse
    const dx = s.x - mouse.x;
    const dy = s.y - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let forceX = 0;
    let forceY = 0;

    if (dist < INTERACTION_RADIUS) {
      const strength = (INTERACTION_RADIUS - dist) / INTERACTION_RADIUS;
      forceX = (dx / dist) * strength * 1.2;
      forceY = (dy / dist) * strength * 1.2;
    }

    // Movimento base + interação
    s.x += s.speedX + forceX;
    s.y += s.speedY + forceY;
    s.rotation += s.rotationSpeed;

    // Desenho
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rotation);

    ctx.fillStyle = `rgba(124, 58, 237, ${s.alpha * 0.85})`;
    ctx.shadowColor = "rgba(124, 58, 237, 0.45)";
    ctx.shadowBlur = 18;


    ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
    ctx.restore();

    // Reset fora da tela
    if (s.x > w + 60 || s.y < -60 || s.x < -60 || s.y > h + 60) {
      Object.assign(s, createSquare());
      s.x = Math.random() * w;
      s.y = h + 40;
    }
  });

  requestAnimationFrame(draw);
}

draw();
