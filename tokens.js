// Known trusted ARC tokens
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").onclick = handleAnalyze;
  document.getElementById("themeToggle").onclick = toggleTheme;
});

// Theme toggle
function toggleTheme() {
  document.body.classList.toggle("dark");
}

// Mainnet blocked
const netSelect = document.getElementById("networkSelect");
netSelect.addEventListener("change", () => {
  if (netSelect.value === "mainnet") {
    alert("Mainnet support is coming soon.");
    netSelect.value = "testnet";
  }
});

async function handleAnalyze() {
  const address = document.getElementById("tokenAddress").value.trim();
  const statusMsg = document.getElementById("statusMsg");

  if (!address.startsWith("0x") || address.length < 20) {
    alert("Enter a valid ARC-20 address.");
    return;
  }

  statusMsg.textContent = "Loading token...";

  try {
    const resp = await fetch(`/api/arc-token?address=${address}`);
    const data = await resp.json();

    if (!resp.ok || !data || !data.symbol) {
      statusMsg.textContent = "Error loading token.";
      return;
    }

    statusMsg.textContent = "Token loaded successfully.";

    fillTokenInfo(address, data);
    applyRiskSignal(address, data);

    document.getElementById("tokenCard").classList.remove("hidden");
    document.getElementById("riskCard").classList.remove("hidden");

  } catch (e) {
    statusMsg.textContent = "Loading failed.";
  }
}

function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name;
  document.getElementById("tSymbol").textContent = token.symbol;
  document.getElementById("tDecimals").textContent = token.decimals;
  document.getElementById("tSupplyRaw").textContent = token.totalSupply;

  const human = formatHumanSupply(token.totalSupply, token.decimals);
  document.getElementById("tSupplyHuman").textContent = human;

  document.getElementById("tokenAvatar").textContent =
    token.symbol?.[0]?.toUpperCase() || "?";

  document.getElementById("tokenTitle").textContent =
    `${token.name} (${token.symbol})`;

  document.getElementById("tokenAddressShort").textContent =
    address.slice(0, 6) + "..." + address.slice(-4);

}

function formatHumanSupply(raw, decimals) {
  try {
    const d = Number(decimals);
    const big = BigInt(raw);
    const factor = BigInt(10) ** BigInt(d);
    const whole = big / factor;
    const frac = (big % factor).toString().padStart(d, "0").slice(0, 4);
    return `${whole.toLocaleString()} . ${frac}`;
  } catch {
    return raw;
  }
}

function applyRiskSignal(address, token) {
  const normalized = address.toLowerCase();

  const riskPill = document.getElementById("riskPill");
  const riskReasons = document.getElementById("riskReasons");
  const verifiedBadge = document.getElementById("verifiedBadge");

  riskReasons.innerHTML = "";
  riskPill.className = "risk-pill risk-unknown";
  verifiedBadge.classList.add("hidden");

  let score = 0;
  const reasons = [];

  // TRUSTED TOKEN
  if (TRUSTED_TOKENS[normalized]) {
    riskPill.textContent = "Trusted";
    riskPill.classList.add("risk-safe");
    verifiedBadge.classList.remove("hidden");
    reasons.push("✔ This contract is on the trusted allowlist.");
    renderReasons(reasons);
    return;
  }

  // DECIMALS
  if (token.decimals === 0 || token.decimals > 18) {
    score += 2;
    reasons.push("⚠ Token uses unusual decimals.");
  } else {
    reasons.push("✔ Decimals look normal.");
  }

  // NAME / SYMBOL
  if (!token.symbol || token.symbol.length < 2 || token.symbol.length > 10) {
    score += 1;
    reasons.push("⚠ Symbol looks unusually short/long.");
  } else {
    reasons.push("✔ Symbol structure looks normal.");
  }

  // TOTAL SUPPLY
  try {
    const supply = BigInt(token.totalSupply);
    if (supply === 0n) {
      score += 2;
      reasons.push("⚠ Total supply is zero — token may be broken.");
    } else {
      reasons.push("✔ Supply value appears valid.");
    }
  } catch {}

  // ADDRESS PATTERN
  if (normalized.startsWith("0x000000")) {
    score += 1;
    reasons.push("⚠ Contract address pattern looks suspicious.");
  } else {
    reasons.push("✔ Address pattern is normal.");
  }

  // MAP SCORE → LEVEL
  let level = "safe";
  if (score >= 5) level = "danger";
  else if (score >= 3) level = "warning";
  else if (score >= 1) level = "caution";

  if (level === "safe") {
    riskPill.textContent = "Likely Safe";
    riskPill.classList.add("risk-safe");
  } else if (level === "caution") {
    riskPill.textContent = "Caution";
    riskPill.classList.add("risk-warning");
  } else if (level === "warning") {
    riskPill.textContent = "Risky";
    riskPill.classList.add("risk-warning");
  } else {
    riskPill.textContent = "High Risk";
    riskPill.classList.add("risk-danger", "glow-danger");
  }

  renderReasons(reasons);
}

// Render WHY breakdown
function renderReasons(list) {
  const ul = document.getElementById("riskReasons");
  ul.innerHTML = "";
  list.forEach(reason => {
    const li = document.createElement("li");
    li.textContent = reason;
    ul.appendChild(li);
  });
}
