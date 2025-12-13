const canvas = document.getElementById("bg-grid");
const ctx = canvas.getContext("2d");

let w, h;
function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// Mouse
const mouse = { x: w / 2, y: h / 2 };
window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// Grid settings
const GRID = 80;
const SPEED = 0.15;

let offsetX = 0;
let offsetY = 0;

function drawGrid() {
  ctx.clearRect(0, 0, w, h);

  offsetX += (mouse.x - w / 2) * 0.00005;
  offsetY += (mouse.y - h / 2) * 0.00005;

  ctx.strokeStyle = "rgba(168, 85, 247, 0.08)";
  ctx.lineWidth = 1;

  for (let x = -GRID; x < w + GRID; x += GRID) {
    ctx.beginPath();
    ctx.moveTo(x + offsetX, 0);
    ctx.lineTo(x + offsetX, h);
    ctx.stroke();
  }

  for (let y = -GRID; y < h + GRID; y += GRID) {
    ctx.beginPath();
    ctx.moveTo(0, y + offsetY);
    ctx.lineTo(w, y + offsetY);
    ctx.stroke();
  }

  requestAnimationFrame(drawGrid);
}

drawGrid();
