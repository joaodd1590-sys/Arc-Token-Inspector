// Network configuration (UI shows Mainnet soon, but only Testnet is active for now.)
const NETWORKS = {
  arcTestnet: {
    label: "ARC Testnet",
    explorerBase: "https://testnet.arcscan.app"
  },
  arcMainnet: {
    label: "ARC Mainnet",
    explorerBase: "https://arcscan.app"
  }
};

// Manual allowlist (only used to show "Verified token" badge + note)
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet",
    refSupply: "25245628768486750"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
  document.getElementById("tokenAddress").addEventListener("keyup", (e) => {
    if (e.key === "Enter") handleAnalyze();
  });

  initThemeToggle();
  initCopy();
});

function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  const body = document.body;

  btn.addEventListener("click", () => {
    const next = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", next);
    btn.textContent = next === "dark" ? "🌙" : "☀️";
  });
}

function initCopy() {
  const btn = document.getElementById("copyAddressBtn");
  btn.addEventListener("click", async () => {
    const el = document.getElementById("tokenAddressShort");
    const full = el?.dataset?.full;
    if (!full) return;

    try {
      await navigator.clipboard.writeText(full);
      btn.textContent = "✔ Copied";
      setTimeout(() => (btn.textContent = "📋 Copy"), 1000);
    } catch {
      btn.textContent = "Error";
      setTimeout(() => (btn.textContent = "📋 Copy"), 1000);
    }
  });
}

function isValidAddress(a) {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

function setLoading(isLoading, text) {
  const btn = document.getElementById("analyzeBtn");
  const statusMsg = document.getElementById("statusMsg");

  btn.disabled = isLoading;
  btn.classList.toggle("is-loading", isLoading);

  if (text) statusMsg.textContent = text;
}

function showInputError(kind, address) {
  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const explorerLink = document.getElementById("explorerLink");

  tokenCard.classList.add("hidden");
  riskCard.classList.remove("hidden");

  if (explorerLink) explorerLink.style.display = "none";

  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");
  const ul = document.querySelector(".risk-notes");
  const verifiedBadge = document.getElementById("verifiedBadge");

  verifiedBadge.classList.add("hidden");
  riskPill.className = "risk-pill risk-warning";
  riskPill.textContent = "⚠️ Invalid input";

  if (kind === "wallet") {
    riskTitle.textContent = "Wallet address detected.";
    riskDesc.textContent =
      "This tool analyzes ARC-20 token contracts only. Wallet addresses are not supported.";
    ul.innerHTML = `
      <li>Please enter a valid ARC-20 contract address.</li>
      <li>No token analysis was performed.</li>
    `;
    return;
  }

  if (kind === "nonTokenContract") {
    riskTitle.textContent = "Contract detected, but not an ARC-20 token.";
    riskDesc.textContent =
      "The address has bytecode, but it doesn't behave like a standard token contract.";
    ul.innerHTML = `
      <li>Address: <span class="mono">${shorten(address)}</span></li>
      <li>Please enter an ARC-20 token contract address.</li>
    `;
    return;
  }

  // default
  riskTitle.textContent = "Invalid address.";
  riskDesc.textContent = "Please paste a valid 0x address.";
  ul.innerHTML = `<li>Expected format: 0x + 40 hex characters.</li>`;
}

async function handleAnalyze() {
  const input = document.getElementById("tokenAddress").value.trim();
  const addr = input;

  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");

  riskCard.classList.add("hidden");
  tokenCard.classList.add("hidden");

  if (!isValidAddress(addr)) {
    showInputError("invalid");
    return;
  }

  const network = "arcTestnet"; // UI only; backend uses this too
  setLoading(true, "Checking address on ARC Testnet...");

  try {
    // Backend does: eth_getCode + eth_call (no CORS issues)
    const resp = await fetch(`/api/arc-token?address=${addr}&network=${network}`);
    const data = await resp.json();

    if (!data || !data.ok) {
      setLoading(false, "Error loading token.");
      showInputError("invalid");
      return;
    }

    if (data.type === "wallet") {
      setLoading(false, "Wallet address detected.");
      showInputError("wallet", addr);
      return;
    }

    if (data.type === "nonTokenContract") {
      setLoading(false, "Not an ARC-20 token contract.");
      showInputError("nonTokenContract", addr);
      return;
    }

    if (data.type !== "token" || !data.token) {
      setLoading(false, "Token not found.");
      showInputError("invalid");
      return;
    }

    // Render token + risk
    fillTokenInfo(addr, data.token, network);
    applyRisk(addr, data.token);

    tokenCard.classList.remove("hidden");
    riskCard.classList.remove("hidden");

    setLoading(false, "Token loaded successfully. Always confirm with the official explorer.");
  } catch (e) {
    console.error(e);
    setLoading(false, "Error loading token.");
    showInputError("invalid");
  }
}

function fillTokenInfo(address, token, networkKey) {
  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent =
    token.decimals ?? "unknown";
  document.getElementById("tSupplyRaw").textContent =
    token.totalSupply ?? "-";

  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  const shortAddr = shorten(address);
  const addrEl = document.getElementById("tokenAddressShort");
  addrEl.textContent = shortAddr;
  addrEl.dataset.full = address;

  const title = `${token.name || "Token"} (${token.symbol || "?"})`;
  document.getElementById("tokenTitle").textContent = title;

  const explorer = NETWORKS[networkKey].explorerBase;
  const explorerLink = document.getElementById("explorerLink");
  explorerLink.href = `${explorer}/token/${address}`;
  explorerLink.style.display = "inline";

  document.getElementById("tokenAvatar").textContent =
    (token.symbol?.[0] || "?").toUpperCase();
}

function shorten(a) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function formatSupply(raw, dec) {
  if (!raw && raw !== "0") return "-";
  try {
    const big = BigInt(raw);
    const d = BigInt(dec ?? 0);
    if (d === 0n) return big.toLocaleString();

    const f = 10n ** d;
    const intPart = big / f;
    const fracPart = big % f;

    return `${intPart.toLocaleString()}.${fracPart
      .toString()
      .padStart(Number(d), "0")
      .slice(0, 4)}`;
  } catch {
    return String(raw);
  }
}

/* ============================================================
   RISK ENGINE (keeps your approach, but now token data is real)
============================================================ */
function applyRisk(address, token) {
  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];

  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");
  const verifiedBadge = document.getElementById("verifiedBadge");

  riskPill.className = "risk-pill";
  verifiedBadge.classList.add("hidden");

  const breakdown = [];
  let totalScore = 0;

  // Allowlist badge (does NOT block other tokens)
  if (trusted) {
    verifiedBadge.classList.remove("hidden");
  }

  // Decimals
  let decimalsScore = 0;
  const decimals = Number(token.decimals ?? 0);
  if (Number.isNaN(decimals)) decimalsScore += 2;
  else if (decimals > 18 || decimals === 0) decimalsScore += 2;

  breakdown.push({
    label: "Decimals",
    score: decimalsScore,
    icon: decimalsScore ? "⚠️" : "✅",
    reason:
      Number.isNaN(decimals)
        ? "Token decimals could not be read."
        : decimals === 0
        ? "Token has 0 decimals — unusual for ERC-20 assets."
        : decimals > 18
        ? "Very high decimals — often used in misleading tokens."
        : "Decimals appear normal."
  });
  totalScore += decimalsScore;

  // Name / Symbol
  let nameSymbolScore = 0;
  const name = token.name || "";
  const symbol = token.symbol || "";

  if (!name || name.length < 3) nameSymbolScore += 1;
  if (!symbol || symbol.length < 2 || symbol.length > 10) nameSymbolScore += 1;

  breakdown.push({
    label: "Name / Symbol",
    score: nameSymbolScore,
    icon: nameSymbolScore ? "⚠️" : "✅",
    reason:
      nameSymbolScore > 0
        ? "Unusual name or symbol length/format."
        : "Name and symbol look well-structured."
  });
  totalScore += nameSymbolScore;

  // Impersonation (soft flag)
  const famousSymbols = ["USDC", "USDT", "ETH", "BTC", "BNB", "ARB", "MATIC"];
  let impersonationScore = 0;
  if (symbol && famousSymbols.includes(symbol.toUpperCase()) && !trusted) {
    impersonationScore += 2;
  }
  breakdown.push({
    label: "Impersonation",
    score: impersonationScore,
    icon: impersonationScore ? "🚩" : "✅",
    reason:
      impersonationScore
        ? `Symbol matches a well-known asset (${symbol}). Could be impersonation.`
        : "No obvious impersonation indicators."
  });
  totalScore += impersonationScore;

  // Supply
  let supplyScore = 0;
  let supply = 0n;
  try {
    supply = BigInt(token.totalSupply ?? "0");
  } catch {
    supplyScore += 2;
  }

  if (supply === 0n) supplyScore += 1;
  if (supply > 10n ** 40n) supplyScore += 2;

  breakdown.push({
    label: "Total supply",
    score: supplyScore,
    icon: supplyScore ? "⚠️" : "✅",
    reason:
      supplyScore >= 2
        ? "Supply is unreadable, zero, or extremely large."
        : "Supply looks normal."
  });
  totalScore += supplyScore;

  // Address pattern (low weight)
  let addrScore = 0;
  if (normalized.startsWith("0x000000")) addrScore += 1;
  breakdown.push({
    label: "Address pattern",
    score: addrScore,
    icon: addrScore ? "⚠️" : "✅",
    reason:
      addrScore ? "Contract starts with many zeros — sometimes deceptive." : "Nothing unusual about the address format."
  });
  totalScore += addrScore;

  // Trusted tokens get a friendly summary but still show breakdown
  if (trusted) {
    breakdown.unshift({
      label: "Trusted list",
      score: 0,
      icon: "🟢",
      reason: trusted.note
    });
  }

  // Final level
  let level = "safe";
  if (totalScore >= 7) level = "danger";
  else if (totalScore >= 4) level = "warning";
  else if (totalScore >= 2) level = "caution";

  if (level === "safe") {
    riskPill.textContent = trusted ? "🟢 Trusted" : "🟢 Likely Safe";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = trusted ? "Allowlisted token." : "No major red flags detected.";
    riskDesc.textContent =
      trusted
        ? "Allowlisted on this tool. Still verify via the official explorer."
        : "Basic heuristics found no severe issues. Still not a safety guarantee.";
  } else if (level === "caution") {
    riskPill.textContent = "⚠️ Caution";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Minor unusual characteristics found.";
    riskDesc.textContent = "Some metadata looks slightly off. Verify carefully.";
  } else if (level === "warning") {
    riskPill.textContent = "⚠️ Risky";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Several red flags detected.";
    riskDesc.textContent = "Interact only if you fully understand the project and risks.";
  } else {
    riskPill.textContent = "🔥 High Risk";
    riskPill.classList.add("risk-danger");
    riskTitle.textContent = "Severe risk indicators detected.";
    riskDesc.textContent = "Token appears extremely suspicious. Avoid interacting.";
  }

  renderRiskNotes(level, totalScore, breakdown);
}

function renderRiskNotes(level, totalScore, breakdown) {
  const ul = document.querySelector(".risk-notes");
  if (!ul) return;

  const levelLabel =
    level === "safe" ? "Likely Safe" :
    level === "caution" ? "Caution" :
    level === "warning" ? "Risky" : "High Risk";

  ul.innerHTML = "";

  const headerLi = document.createElement("li");
  headerLi.innerHTML = `<strong>Why this rating? (${levelLabel}, score ${totalScore})</strong>`;
  ul.appendChild(headerLi);

  breakdown.forEach((b) => {
    const li = document.createElement("li");
    li.innerHTML = `${b.icon} <strong>${b.label}:</strong> ${b.reason}${b.score ? ` (score +${b.score})` : ""}`;
    ul.appendChild(li);
  });

  const liHeuristic = document.createElement("li");
  liHeuristic.textContent = "Heuristic only — always verify the contract manually.";
  ul.appendChild(liHeuristic);

  const liReadOnly = document.createElement("li");
  liReadOnly.textContent = "Read-only analysis. No wallet connection required.";
  ul.appendChild(liReadOnly);
}
