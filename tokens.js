// TRUSTED TOKENS
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

function toggleTheme() {
  document.body.classList.toggle("light");
}

async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  if (!addr || !addr.startsWith("0x")) return alert("Invalid address");

  const results = document.getElementById("results");
  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");

  results.classList.remove("hidden");
  riskCard.classList.add("hidden");
  tokenCard.classList.add("hidden");

  const resp = await fetch(`/api/arc-token?address=${addr}`);
  const data = await resp.json();

  if (!data || !data.name) {
    document.getElementById("statusMsg").textContent = "Error loading token.";
    return;
  }

  fillTokenInfo(addr, data);
  applyRisk(addr, data);

  tokenCard.classList.remove("hidden");
  riskCard.classList.remove("hidden");
}

function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name;
  document.getElementById("tSymbol").textContent = token.symbol;
  document.getElementById("tDecimals").textContent = token.decimals;
  document.getElementById("tSupplyRaw").textContent = token.totalSupply;
  document.getElementById("tSupplyHuman").textContent = token.totalSupply;

  document.getElementById("tokenTitle").textContent = `${token.name} (${token.symbol})`;
  document.getElementById("tokenAddressShort").textContent = address.substring(0, 6) + "..." + address.slice(-4);

  document.getElementById("tokenAvatar").textContent =
    (token.symbol?.[0] || token.name?.[0] || "?").toUpperCase();

  document.getElementById("statusMsg").textContent =
    "Token loaded successfully.";
}

function applyRisk(address, token) {
  const pill = document.getElementById("riskPill");
  const verified = document.getElementById("verifiedBadge");
  const scoreText = document.getElementById("riskScoreText");
  const list = document.getElementById("riskBreakdown");

  list.innerHTML = "";
  pill.className = "risk-pill risk-unknown";
  verified.classList.add("hidden");

  let score = 0;
  const checks = [];

  const trusted = TRUSTED_TOKENS[address.toLowerCase()];
  if (trusted) {
    pill.textContent = "TRUSTED";
    pill.classList.add("risk-safe");
    verified.classList.remove("hidden");
    scoreText.textContent = "Risk score: 0";
    return;
  }

  // SIMPLE RISK SYSTEM
  if (token.decimals === 0) { score += 2; checks.push("⚠️ Token has 0 decimals."); }
  else checks.push("✅ Decimals look normal.");

  if (token.totalSupply === "0") { score += 2; checks.push("⚠️ Total supply = 0."); }
  else checks.push("ℹ️ Supply appears normal.");

  checks.push("ℹ️ Address looks typical.");

  // APPLY PILL
  if (score === 0) {
    pill.textContent = "LIKELY SAFE";
    pill.classList.add("risk-safe");
  } else if (score <= 2) {
    pill.textContent = "CAUTION";
    pill.classList.add("risk-warning");
  } else {
    pill.textContent = "RISKY";
    pill.classList.add("risk-danger");
  }

  scoreText.textContent = `Risk score: ${score}`;
  checks.forEach(c => {
    const li = document.createElement("li");
    li.textContent = c;
    list.appendChild(li);
  });
}
