// Known trusted tokens
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
});

// MAIN FUNCTION
async function handleAnalyze() {
  const input = document.getElementById("tokenAddress");
  const address = input.value.trim();

  if (!address || !address.startsWith("0x")) {
    alert("Enter a valid contract address.");
    return;
  }

  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const statusMsg = document.getElementById("statusMsg");

  riskCard.classList.add("hidden");
  tokenCard.classList.add("hidden");

  statusMsg.textContent = "Loading token data...";

  try {
    const resp = await fetch(`/api/arc-token?address=${address}`);
    const data = await resp.json();

    if (!resp.ok || !data.name) {
      statusMsg.textContent = "Token not found.";
      return;
    }

    fillTokenInfo(address, data);
    applyRiskSignal(address, data);

    riskCard.classList.remove("hidden");
    tokenCard.classList.remove("hidden");
    statusMsg.textContent = "Token loaded successfully.";

  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Error loading token.";
  }
}

// FILL TOKEN INFO
function fillTokenInfo(address, token) {
  document.getElementById("tokenTitle").textContent =
    `${token.name} (${token.symbol})`;

  document.getElementById("tokenAddressShort").textContent =
    address.slice(0, 6) + "..." + address.slice(-4);

  const avatar = (token.symbol || "?")[0].toUpperCase();
  document.getElementById("tokenAvatar").textContent = avatar;

  document.getElementById("tName").textContent = token.name;
  document.getElementById("tSymbol").textContent = token.symbol;
  document.getElementById("tDecimals").textContent = token.decimals;
  document.getElementById("tSupplyRaw").textContent = token.totalSupply;
  document.getElementById("tSupplyHuman").textContent =
    formatHumanSupply(token.totalSupply, token.decimals);
}

// FORMAT SUPPLY
function formatHumanSupply(raw, decimals) {
  try {
    const d = Number(decimals || 0);
    const big = BigInt(raw);
    const factor = 10n ** BigInt(d);

    const intPart = big / factor;
    const fracPart = String(big % factor).padStart(d, "0").slice(0, 4);

    return `${intPart}.${fracPart}`;
  } catch {
    return raw;
  }
}

// RISK ANALYSIS
function applyRiskSignal(address, token) {
  const pill = document.getElementById("riskPill");
  const badge = document.getElementById("verifiedBadge");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");
  const breakdown = document.getElementById("riskBreakdown");

  badge.classList.add("hidden");
  pill.className = "risk-pill risk-unknown";

  const addr = address.toLowerCase();

  let score = 0;
  let reasons = [];

  // TRUSTED LIST
  if (TRUSTED_TOKENS[addr]) {
    pill.textContent = "Trusted";
    pill.classList.add("risk-safe");
    badge.classList.remove("hidden");
    title.textContent = `${token.symbol} is trusted`;
    desc.textContent = TRUSTED_TOKENS[addr].note;
    breakdown.innerHTML = "";
    return;
  }

  // DECIMALS
  if (token.decimals === 0 || token.decimals > 18) {
    score += 2;
    reasons.push("⚠️ Decimals unusual (score +2).");
  } else {
    reasons.push("✅ Decimals look normal.");
  }

  // NAME/SYMBOL
  if (token.symbol.length > 8 || token.symbol.length < 2) {
    score += 1;
    reasons.push("⚠️ Symbol looks unusual (score +1).");
  } else {
    reasons.push("✅ Name/symbol normal.");
  }

  // ZERO SUPPLY
  if (token.totalSupply === "0") {
    score += 2;
    reasons.push("⚠️ Total supply is zero (score +2).");
  } else {
    reasons.push("ℹ️ Supply appears normal.");
  }

  // ADDRESS PATTERN
  if (addr.startsWith("0x000000")) {
    score += 2;
    reasons.push("⚠️ Address pattern suspicious (score +2).");
  } else {
    reasons.push("ℹ️ Address looks typical.");
  }

  // MAP SCORE → LEVEL
  let level = "safe";
  if (score >= 5) level = "danger";
  else if (score >= 3) level = "warning";
  else if (score >= 1) level = "caution";

  if (level === "safe") {
    pill.textContent = "Likely Safe";
    pill.classList.add("risk-safe");
  } else if (level === "caution") {
    pill.textContent = "Caution";
    pill.classList.add("risk-warning");
  } else if (level === "warning") {
    pill.textContent = "Risky";
    pill.classList.add("risk-warning");
  } else {
    pill.textContent = "High Risk";
    pill.classList.add("risk-danger");
  }

  // EXPLANATION
  title.textContent = `Why this rating?`;
  desc.textContent = `Risk score: ${score}`;

  breakdown.innerHTML =
    "<ul>" + reasons.map(r => `<li>${r}</li>`).join("") + "</ul>";
}
