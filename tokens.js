// Known trusted tokens on ARC
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
});

async function handleAnalyze() {
  const input = document.getElementById("tokenAddress");
  const address = input.value.trim();

  if (!address || !address.startsWith("0x") || address.length < 10) {
    alert("Please enter a valid token contract address (0x...).");
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

    if (!data || !data.name) {
      statusMsg.textContent = "Token not found or API error.";
      return;
    }

    fillTokenInfo(address, data);
    applyRiskSignal(address, data);

    riskCard.classList.remove("hidden");
    tokenCard.classList.remove("hidden");
    statusMsg.textContent = "Token loaded successfully.";
    
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Failed to load token.";
  }
}

function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent = token.decimals ?? "-";
  document.getElementById("tSupplyRaw").textContent = token.totalSupply || "-";

  const human = formatHumanSupply(token.totalSupply, token.decimals);
  document.getElementById("tSupplyHuman").textContent = human;

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

function applyRiskSignal(address, token) {
  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];

  const pill = document.getElementById("riskPill");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");
  const list = document.getElementById("riskList");

  pill.className = "risk-pill risk-unknown";
  list.innerHTML = "";

  let score = 0;
  let reasons = [];

  // 1) Trusted tokens
  if (trusted) {
    pill.textContent = "Trusted";
    pill.classList.add("risk-safe");
    title.textContent = `${token.symbol} is marked as trusted.`;
    desc.textContent = trusted.note;
    return;
  }

  // Parse values
  const decimals = Number(token.decimals || 0);
  const supply = token.totalSupply ? BigInt(token.totalSupply) : null;

  // 🔎 New Rule 1: Strange metadata
  if (!token.name || token.name.length < 3 || token.name.length > 32) {
    score += 1;
    reasons.push("⚠️ Name looks unusual (too short or too long). (+1)");
  }
  if (!token.symbol || token.symbol.length < 2 || token.symbol.length > 8) {
    score += 1;
    reasons.push("⚠️ Symbol length is non-standard. (+1)");
  }
  if (token.symbol && !/^[A-Z0-9]+$/i.test(token.symbol)) {
    score += 1;
    reasons.push("⚠️ Symbol contains unusual characters. (+1)");
  }

  // 🔎 New Rule 2: Small or incoherent supply
  if (supply !== null) {
    if (supply === 1n) {
      score += 1;
      reasons.push("⚠️ Supply = 1, unusual for fungible tokens. (+1)");
    }
    if (supply < 100n) {
      score += 1;
      reasons.push("⚠️ Very low supply, uncommon for ERC-20. (+1)");
    }
  }

  // 🔎 Existing Rules
  if (decimals === 0 || decimals > 18) {
    score += 1;
    reasons.push("⚠️ Suspicious decimals (0 or too high). (+1)");
  }

  if (supply === 0n) {
    score += 2;
    reasons.push("⚠️ Supply is zero — token may be misconfigured. (+2)");
  }

  if (normalized.startsWith("0x000000")) {
    score += 2;
    reasons.push("⚠️ Address begins with 0x000000 — unusual. (+2)");
  }

  // 🔎 New Rule 4: Incomplete ERC-20
  const missing = [];
  if (!token.name) missing.push("name");
  if (!token.symbol) missing.push("symbol");
  if (!token.decimals && token.decimals !== 0) missing.push("decimals");
  if (!token.totalSupply) missing.push("totalSupply");

  if (missing.length > 0) {
    score += 2;
    reasons.push(`⚠️ Incomplete ERC-20 metadata: missing ${missing.join(", ")}. (+2)`);
  }

  // DETERMINE LEVEL
  let level = "safe";
  if (score >= 6) level = "danger";
  else if (score >= 4) level = "warning";
  else if (score >= 2) level = "caution";

  if (level === "safe") {
    pill.textContent = "Likely Safe";
    pill.classList.add("risk-safe");
    title.textContent = "No major red flags detected.";
  } else if (level === "caution") {
    pill.textContent = "Caution";
    pill.classList.add("risk-warning");
    title.textContent = "Some unusual properties detected.";
  } else if (level === "warning") {
    pill.textContent = "Risky";
    pill.classList.add("risk-warning");
    title.textContent = "Multiple red flags detected.";
  } else {
    pill.textContent = "High Risk";
    pill.classList.add("risk-danger", "glow-danger");
    title.textContent = "Severe red flags — avoid this token.";
  }

  desc.textContent = `Risk score: ${score}`;

  reasons.forEach(r => {
    const li = document.createElement("li");
    li.textContent = r;
    list.appendChild(li);
  });
}
