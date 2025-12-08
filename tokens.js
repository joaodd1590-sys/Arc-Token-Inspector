// TRUSTED TOKENS LIST
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
});

// THEME SWITCH
function toggleTheme() {
  document.body.classList.toggle("light");
  document.body.classList.toggle("dark");
}

// MAIN ANALYSIS
async function handleAnalyze() {
  const address = document.getElementById("tokenAddress").value.trim();

  if (!address.startsWith("0x") || address.length < 12) {
    alert("Enter a valid ARC-20 address");
    return;
  }

  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  riskCard.classList.add("hidden");
  tokenCard.classList.add("hidden");

  document.getElementById("statusMsg").textContent = "Loading token...";

  try {
    const url = `/api/arc-token?address=${address}`;
    const res = await fetch(url);
    const token = await res.json();

    if (!token || !token.name) {
      document.getElementById("statusMsg").textContent = "Error loading token.";
      return;
    }

    fillToken(token, address);
    evaluateRisk(token, address);

    riskCard.classList.remove("hidden");
    tokenCard.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    document.getElementById("statusMsg").textContent = "API error.";
  }
}

// FILL TOKEN CARD
function fillToken(token, address) {
  document.getElementById("tokenTitle").textContent = `${token.name} (${token.symbol})`;
  document.getElementById("tokenAddressShort").textContent = shorten(address);
  document.getElementById("tokenAvatar").textContent = token.symbol[0].toUpperCase();

  document.getElementById("tName").textContent = token.name;
  document.getElementById("tSymbol").textContent = token.symbol;
  document.getElementById("tDecimals").textContent = token.decimals;
  document.getElementById("tSupplyRaw").textContent = token.totalSupply;
  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  document.getElementById("statusMsg").textContent =
    "Token loaded successfully.";
}

// RISK EVALUATION (original layout)
function evaluateRisk(token, address) {
  const pill = document.getElementById("riskPill");
  const desc = document.getElementById("riskDescription");
  const list = document.getElementById("riskList");
  const breakdown = document.getElementById("riskBreakdown");

  list.innerHTML = "";
  breakdown.classList.remove("hidden");

  let score = 0;
  const reasons = [];

  // Trusted?
  if (TRUSTED_TOKENS[address.toLowerCase()]) {
    pill.textContent = "TRUSTED";
    pill.className = "risk-pill risk-safe";
    desc.textContent = "This token is marked as trusted.";
    return;
  }

  // DECIMALS
  if (token.decimals === 0 || token.decimals > 18) {
    score += 2;
    reasons.push("⚠️ Decimals unusual.");
  } else {
    reasons.push("✅ Decimals normal.");
  }

  // NAME/SYMBOL
  if (!token.name || token.name.length < 3) {
    score += 1;
    reasons.push("⚠️ Name/symbol suspicious.");
  } else {
    reasons.push("✅ Name/symbol normal.");
  }

  // SUPPLY
  const supply = BigInt(token.totalSupply || "0");
  if (supply === 0n) {
    score += 2;
    reasons.push("⚠️ Total supply is zero.");
  } else {
    reasons.push("ℹ️ Supply appears normal.");
  }

  // ADDRESS PATTERN
  if (address.toLowerCase().startsWith("0x000000")) {
    score += 2;
    reasons.push("⚠️ Suspicious address pattern.");
  } else {
    reasons.push("ℹ️ Address looks typical.");
  }

  // APPLY RISK BADGE
  if (score === 0) {
    pill.textContent = "LIKELY SAFE";
    pill.className = "risk-pill risk-safe";
    desc.textContent = "No red flags detected.";
  } else if (score <= 2) {
    pill.textContent = "CAUTION";
    pill.className = "risk-pill risk-warning";
    desc.textContent = "Some minor issues detected.";
  } else if (score <= 4) {
    pill.textContent = "RISKY";
    pill.className = "risk-pill risk-warning";
    desc.textContent = "Several red flags detected.";
  } else {
    pill.textContent = "HIGH RISK";
    pill.className = "risk-pill risk-danger glow-danger";
    desc.textContent = "Strong red flags — avoid interacting.";
  }

  reasons.forEach(r => {
    const li = document.createElement("li");
    li.textContent = r;
    list.appendChild(li);
  });
}

// HELPERS
function shorten(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatSupply(raw, decimals) {
  try {
    const big = BigInt(raw);
    const factor = BigInt(10) ** BigInt(decimals);
    return (big / factor).toString();
  } catch {
    return raw;
  }
}
