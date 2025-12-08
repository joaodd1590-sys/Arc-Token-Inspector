// Known trusted tokens
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet",
  },
};

document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelector(".network-tab.locked")
    .addEventListener("click", (e) => {
      e.preventDefault();
      alert("Mainnet soon — not available yet.");
    });

  document.getElementById("analyzeBtn").addEventListener("click", loadToken);
});

// GLOBAL CHART INSTANCES
let pieChart = null;
let barChart = null;
let scoreChart = null;

async function loadToken() {
  const address = document.getElementById("tokenAddress").value.trim();
  if (!address.startsWith("0x")) {
    alert("Invalid address.");
    return;
  }

  const status = document.getElementById("statusMsg");
  status.textContent = "Loading…";

  const tokenCard = document.getElementById("tokenCard");
  const riskCard = document.getElementById("riskCard");
  const charts = document.getElementById("chartsSection");

  tokenCard.classList.add("hidden");
  riskCard.classList.add("hidden");
  charts.classList.add("hidden");

  try {
    const response = await fetch(`/api/arc-token?address=${address}`);
    const data = await response.json();

    if (!data.name) {
      status.textContent = "Token not found.";
      return;
    }

    status.textContent = "Token loaded.";

    fillInfo(address, data);
    const risk = computeRisk(address, data);
    applyRisk(risk);

    renderCharts(risk);

    tokenCard.classList.remove("hidden");
    riskCard.classList.remove("hidden");
    charts.classList.remove("hidden");
  } catch (err) {
    status.textContent = "Error loading token.";
  }
}

function fillInfo(address, token) {
  document.getElementById("tName").textContent = token.name;
  document.getElementById("tSymbol").textContent = token.symbol;
  document.getElementById("tDecimals").textContent = token.decimals;
  document.getElementById("tSupplyRaw").textContent = token.totalSupply;

  const big = BigInt(token.totalSupply);
  const dec = BigInt(token.decimals);
  const human = big / 10n ** dec;

  document.getElementById("tSupplyHuman").textContent =
    human.toLocaleString("en-US");

  document.getElementById("tokenTitle").textContent =
    `${token.name} (${token.symbol})`;

  document.getElementById("tokenAddressShort").textContent =
    address.slice(0, 6) + "..." + address.slice(-4);

  document.getElementById("tokenAvatar").textContent =
    token.symbol[0].toUpperCase();
}

// ADVANCED RISK SYSTEM
function computeRisk(address, token) {
  let labels = [];
  let values = [];
  let cumulative = [];

  let score = 0;
  const push = (label, value) => {
    score += value;
    labels.push(label);
    values.push(value);
    cumulative.push(score);
  };

  // Trusted list
  if (TRUSTED_TOKENS[address.toLowerCase()]) {
    return {
      level: "safe",
      levelIndex: 0,
      labels: ["Trusted token"],
      values: [0],
      cumulative: [0],
      total: 0,
    };
  }

  // DECIMALS
  push("Decimals", token.decimals === 0 || token.decimals > 18 ? 2 : 0);

  // NAME / SYMBOL
  push(
    "Name / Symbol",
    token.symbol.length < 2 || token.symbol.length > 8 ? 1 : 0
  );

  // IMPERSONATION
  push(
    "Impersonation",
    ["USDC", "USDT", "ETH"].includes(token.symbol.toUpperCase()) ? 2 : 0
  );

  // SUPPLY
  const supply = BigInt(token.totalSupply);
  push("Total supply", supply === 0n ? 2 : supply > 10n ** 40n ? 2 : 0);

  // ADDRESS PATTERN
  push("Address pattern", address.startsWith("0x000000") ? 2 : 0);

  // CONTRACT VERIFIED (placeholder)
  push("Contract verification", 1);

  // HONEYPOT CHECK (placeholder)
  push("Honeypot checks", 1);

  // CREATION AGE (placeholder)
  push("Creation age", 1);

  const total = score;
  let level = "safe";
  let levelIndex = 0;

  if (total >= 8) {
    level = "danger";
    levelIndex = 3;
  } else if (total >= 5) {
    level = "warning";
    levelIndex = 2;
  } else if (total >= 2) {
    level = "caution";
    levelIndex = 1;
  }

  return { labels, values, cumulative, total, level, levelIndex };
}

// APPLY RISK TO UI
function applyRisk(risk) {
  const pill = document.getElementById("riskPill");
  const badge = document.getElementById("verifiedBadge");

  pill.className = "risk-pill";

  if (risk.level === "safe") {
    pill.textContent = "Likely Safe";
    pill.classList.add("risk-safe");
    badge.classList.add("hidden");
  } else if (risk.level === "caution") {
    pill.textContent = "Caution";
    pill.classList.add("risk-warning");
    badge.classList.add("hidden");
  } else if (risk.level === "warning") {
    pill.textContent = "Risky";
    pill.classList.add("risk-warning");
    badge.classList.add("hidden");
  } else {
    pill.textContent = "High Risk";
    pill.classList.add("risk-danger");
    badge.classList.add("hidden");
  }

  document.querySelector(".risk-title").textContent =
    risk.level === "safe"
      ? "No major red flags detected."
      : `Detected risk level: ${risk.level.toUpperCase()}`;

  document.querySelector(".risk-description").textContent =
    `Total heuristic score: ${risk.total}`;
}

// CHARTS
function renderCharts(risk) {
  const ctxPie = document.getElementById("riskPie").getContext("2d");
  const ctxBars = document.getElementById("riskBars").getContext("2d");
  const ctxScore = document.getElementById("scoreProgress").getContext("2d");

  // Destroy old charts
  if (pieChart) pieChart.destroy();
  if (barChart) barChart.destroy();
  if (scoreChart) scoreChart.destroy();

  const pieData = [0, 0, 0, 0];
  pieData[risk.levelIndex] = 1;

  pieChart = new Chart(ctxPie, {
    type: "pie",
    data: {
      labels: ["Safe", "Caution", "Risky", "High Risk"],
      datasets: [
        {
          data: pieData,
          backgroundColor: ["#22c55e", "#facc15", "#fb923c", "#ef4444"],
        },
      ],
    },
    options: { responsive: true },
  });

  barChart = new Chart(ctxBars, {
    type: "bar",
    data: {
      labels: risk.labels,
      datasets: [
        {
          label: "Score",
          data: risk.values,
          backgroundColor: "#3b82f6",
        },
      ],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, max: 3 } },
    },
  });

  scoreChart = new Chart(ctxScore, {
    type: "line",
    data: {
      labels: risk.labels,
      datasets: [
        {
          label: "Cumulative score",
          data: risk.cumulative,
          borderColor: "#fb923c",
          backgroundColor: "rgba(251,146,60,0.25)",
        },
      ],
    },
    options: { responsive: true, tension: 0.3 },
  });
}
