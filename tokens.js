// Known trusted tokens on ARC (you can add more here)
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

// Tokens famous enough to detect impersonation
const WELL_KNOWN = [
  "USDC",
  "USDT",
  "ETH",
  "BTC",
  "SOL",
  "BNB",
  "DAI"
];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
});

/* MAIN FUNCTION ----------------------------------------- */
async function handleAnalyze() {
  const address = document.getElementById("tokenAddress").value.trim();

  if (!address || !address.startsWith("0x") || address.length < 10) {
    alert("Please enter a valid ARC-20 token address.");
    return;
  }

  const tokenCard = document.getElementById("tokenCard");
  const riskCard = document.getElementById("riskCard");
  const statusMsg = document.getElementById("statusMsg");

  tokenCard.classList.add("hidden");
  riskCard.classList.add("hidden");

  statusMsg.textContent = "Fetching token data...";

  try {
    const r = await fetch(`/api/arc-token?address=${address}`);
    const data = await r.json();

    if (!data || !data.name) {
      statusMsg.textContent = "Token not found or API error.";
      return;
    }

    /* fill info */
    fillTokenInfo(address, data);

    /* risk evaluation */
    applyRiskSignal(address, data);

    tokenCard.classList.remove("hidden");
    riskCard.classList.remove("hidden");

    statusMsg.textContent = "Token loaded successfully.";

  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Error loading token.";
  }
}


/* TOKEN INFO ------------------------------------------- */
function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent = token.decimals ?? "-";
  document.getElementById("tSupplyRaw").textContent = token.totalSupply || "-";

  document.getElementById("tSupplyHuman").textContent =
    formatHumanSupply(token.totalSupply, token.decimals);

  document.getElementById("tokenTitle").textContent =
    `${token.name || "Token"} (${token.symbol || "?"})`;

  document.getElementById("tokenAddressShort").textContent =
    shortenAddress(address);

  const avatar = document.getElementById("tokenAvatar");
  avatar.textContent = (token.symbol?.[0] || token.name?.[0] || "?").toUpperCase();
}

function shortenAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatHumanSupply(raw, decimals) {
  if (!raw) return "-";
  try {
    const d = Number(decimals || 0);
    const big = BigInt(raw);
    const factor = BigInt(10) ** BigInt(d);
    const intPart = big / factor;
    const frac = (big % factor).toString().padStart(d, "0").slice(0, 4);
    return `${intPart.toLocaleString("en-US")}.${frac}`;
  } catch {
    return raw;
  }
}


/* RISK ANALYSIS ------------------------------------------- */
function applyRiskSignal(address, token) {
  const pill = document.getElementById("riskPill");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");
  const list = document.getElementById("riskList");

  pill.className = "risk-pill risk-unknown";
  list.innerHTML = "";

  const reasons = [];
  let score = 0;

  const normalized = address.toLowerCase();
  const supply = token.totalSupply ? BigInt(token.totalSupply) : null;
  const decimals = Number(token.decimals || 0);

  /* 1) trusted list */
  if (TRUSTED_TOKENS[normalized]) {
    const info = TRUSTED_TOKENS[normalized];

    pill.textContent = "Trusted";
    pill.classList.add("risk-safe");

    title.textContent = `${token.symbol} is a verified ARC token.`;
    desc.textContent = info.note;

    return;
  }

  /* 2) suspicious decimals */
  if (decimals > 18 || decimals === 0) {
    score += 1;
    reasons.push("⚠ Decimals unusually large or zero (+1)");
  }

  /* 3) weird name */
  if (!token.name || token.name.length < 3) {
    score += 1;
    reasons.push("⚠ Name too short / incomplete (+1)");
  }

  /* 4) weird symbol */
  if (!token.symbol || token.symbol.length < 2 || token.symbol.length > 8) {
    score += 1;
    reasons.push("⚠ Symbol length unusual (+1)");
  }
  if (token.symbol && !/^[A-Z0-9]+$/i.test(token.symbol)) {
    score += 1;
    reasons.push("⚠ Symbol contains unusual characters (+1)");
  }

  /* 5) impersonation check */
  if (WELL_KNOWN.some((t) => token.symbol?.toUpperCase() === t)) {
    score += 2;
    reasons.push("❗ Symbol matches a famous token — possible impersonation (+2)");
  }

  /* 6) supply anomalies */
  if (supply === 0n) {
    score += 2;
    reasons.push("❗ Total supply is zero — broken token (+2)");
  } else if (supply === 1n) {
    score += 1;
    reasons.push("⚠ Supply = 1 (unusual for fungible tokens) (+1)");
  } else if (supply && supply < 100n) {
    score += 1;
    reasons.push("⚠ Very low supply (<100) (+1)");
  }

  /* 7) address pattern */
  if (normalized.startsWith("0x000000")) {
    score += 2;
    reasons.push("❗ Address starts with many zeros — suspicious pattern (+2)");
  }

  /* 8) incomplete ERC-20 metadata */
  const missing = [];

  if (!token.name) missing.push("name");
  if (!token.symbol) missing.push("symbol");
  if (token.decimals == null) missing.push("decimals");
  if (!token.totalSupply) missing.push("totalSupply");

  if (missing.length > 0) {
    score += 2;
    reasons.push(`⚠ Missing ERC-20 fields: ${missing.join(", ")} (+2)`);
  }

  /* --- DETERMINE RISK LEVEL --- */
  let level = "safe";

  if (score >= 8) level = "danger";
  else if (score >= 5) level = "warning";
  else if (score >= 2) level = "caution";

  if (level === "safe") {
    pill.textContent = "Likely Safe";
    pill.classList.add("risk-safe");
    title.textContent = "No major red flags detected.";
  } else if (level === "caution") {
    pill.textContent = "Caution";
    pill.classList.add("risk-warning");
    title.textContent = "Some unusual attributes found.";
  } else if (level === "warning") {
    pill.textContent = "Risky";
    pill.classList.add("risk-warning");
    title.textContent = "Multiple red flags detected.";
  } else {
    pill.textContent = "High Risk";
    pill.classList.add("risk-danger", "glow-danger");
    title.textContent = "Severe red flags — avoid interacting.";
  }

  desc.textContent = `Risk Score: ${score}`;

  reasons.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r;
    list.appendChild(li);
  });
}
