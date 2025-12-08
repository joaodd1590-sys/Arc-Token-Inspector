// Known trusted tokens
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);

  // BLOQUEAR MAINNET
  const network = document.getElementById("networkSelect");
  network.addEventListener("change", () => {
    if (network.value === "mainnet") {
      alert("ARC Mainnet not available yet — Coming soon!");
      network.value = "testnet";
    }
  });
});

async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  const status = document.getElementById("statusMsg");

  if (!addr || !addr.startsWith("0x")) {
    return alert("Enter a valid ARC-20 contract address.");
  }

  status.textContent = "Loading token data...";

  const resp = await fetch(`/api/arc-token?address=${addr}`);
  const data = await resp.json();

  if (!resp.ok || !data?.name) {
    status.textContent = "Error loading token.";
    return;
  }

  fillInfo(addr, data);
  applyRisk(addr, data);
  status.textContent = "Token loaded successfully.";
}

function fillInfo(addr, token) {
  document.getElementById("tokenCard").classList.remove("hidden");

  document.getElementById("tName").textContent = token.name;
  document.getElementById("tSymbol").textContent = token.symbol;
  document.getElementById("tDecimals").textContent = token.decimals;
  document.getElementById("tSupplyRaw").textContent = token.totalSupply;
  document.getElementById("tSupplyHuman").textContent =
    Number(token.totalSupply) / 10 ** token.decimals;

  document.getElementById("tokenTitle").textContent =
    `${token.name} (${token.symbol})`;

  document.getElementById("tokenAddressShort").textContent =
    addr.slice(0, 6) + "..." + addr.slice(-4);

  document.getElementById("tokenAvatar").textContent =
    token.symbol[0].toUpperCase();
}

function applyRisk(addr, token) {
  const riskCard = document.getElementById("riskCard");
  riskCard.classList.remove("hidden");

  const pill = document.getElementById("riskPill");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");
  const breakdown = document.getElementById("riskBreakdown");

  let score = 0;
  let reasons = [];

  // decimals
  if (token.decimals === 0) {
    score += 2;
    reasons.push("⚠️ Token has 0 decimals — unusual.");
  }

  // supply
  if (token.totalSupply === "0") {
    score += 2;
    reasons.push("⚠️ Total supply is zero — token may be broken.");
  }

  const lowAddr = addr.toLowerCase();
  if (lowAddr.startsWith("0x000000")) {
    score += 1;
    reasons.push("⚠️ Address pattern looks suspicious.");
  }

  // trusted token override
  if (TRUSTED_TOKENS[lowAddr]) {
    pill.textContent = "Trusted";
    pill.className = "risk-pill risk-safe";
    title.textContent = "Token is marked as trusted.";
    desc.textContent = TRUSTED_TOKENS[lowAddr].note;

    breakdown.innerHTML = "";
    return;
  }

  // determine label
  let label = "Safe";
  let cls = "risk-safe";

  if (score >= 4) { label = "High Risk"; cls = "risk-danger"; }
  else if (score >= 2) { label = "Risky"; cls = "risk-warning"; }
  else if (score >= 1) { label = "Caution"; cls = "risk-warning"; }

  pill.textContent = label;
  pill.className = `risk-pill ${cls}`;

  title.textContent = `${label} rating (score ${score})`;
  desc.textContent = "Heuristic checks indicate: ";

  breakdown.innerHTML =
    "<h3>Why this rating?</h3><ul>" +
    reasons.map(r => `<li>${r}</li>`).join("") +
    "</ul>";
}
