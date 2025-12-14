// ==================================================
// Network configuration
// ==================================================
const NETWORKS = {
  arcTestnet: {
    label: "ARC Testnet",
    explorerBase: "https://testnet.arcscan.app"
  }
};

// ==================================================
// Trusted tokens (manual allowlist)
// ==================================================
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
  document.getElementById("tokenAddress").addEventListener("keyup", e => {
    if (e.key === "Enter") handleAnalyze();
  });

  initThemeToggle();
  initCopy();
});

// ==================================================
// Theme toggle
// ==================================================
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  const body = document.body;

  btn.addEventListener("click", () => {
    const next = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", next);
    btn.textContent = next === "dark" ? "🌙" : "☀️";
  });
}

// ==================================================
// Copy address
// ==================================================
function initCopy() {
  const btn = document.getElementById("copyAddressBtn");
  btn.addEventListener("click", async () => {
    const full = document.getElementById("tokenAddressShort")?.dataset.full;
    if (!full) return;

    await navigator.clipboard.writeText(full);
    btn.textContent = "✔ Copied";
    setTimeout(() => (btn.textContent = "📋 Copy"), 1000);
  });
}

// ==================================================
// On-chain contract detection (wallet vs contract)
// ==================================================
async function isContractAddress(address) {
  try {
    const res = await fetch(
      `https://testnet.arcscan.app/api?module=proxy&action=eth_getCode&address=${address}&tag=latest`
    );
    const json = await res.json();
    return json.result && json.result !== "0x";
  } catch {
    return false;
  }
}

// ==================================================
// Wallet input UX
// ==================================================
function showWalletInputError() {
  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const explorerLink = document.getElementById("explorerLink");

  tokenCard.classList.add("hidden");
  riskCard.classList.remove("hidden");
  if (explorerLink) explorerLink.style.display = "none";

  document.getElementById("riskPill").className = "risk-pill risk-warning";
  document.getElementById("riskPill").textContent = "⚠️ Invalid input";
  document.getElementById("riskTitle").textContent = "Wallet address detected.";
  document.getElementById("riskDescription").textContent =
    "This tool analyzes ARC-20 token contracts only.";

  document.querySelector(".risk-notes").innerHTML = `
    <li>Please enter a valid ARC-20 contract address.</li>
    <li>No token analysis was performed.</li>
  `;
}

// ==================================================
// Main handler
// ==================================================
async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  if (!addr.startsWith("0x")) return alert("Invalid address.");

  const normalized = addr.toLowerCase();
  const explorerLink = document.getElementById("explorerLink");

  if (explorerLink) explorerLink.style.display = "none";

  const resp = await fetch(`/api/arc-token?address=${addr}&network=arcTestnet`);
  const data = await resp.json();

  // If API returns no metadata, confirm if it's a wallet
  if (!data || !data.name || !data.symbol) {
    const isContract = await isContractAddress(addr);
    if (!isContract) {
      showWalletInputError();
      return;
    }
  }

  fillTokenInfo(addr, data);
  applyRisk(addr, data);

  if (explorerLink) {
    explorerLink.href = `${NETWORKS.arcTestnet.explorerBase}/token/${addr}`;
    explorerLink.style.display = "inline";
  }

  document.getElementById("tokenCard").classList.remove("hidden");
  document.getElementById("riskCard").classList.remove("hidden");
}

// ==================================================
// Token info
// ==================================================
function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name || "Unknown";
  document.getElementById("tSymbol").textContent = token.symbol || "???";
  document.getElementById("tDecimals").textContent = token.decimals ?? "unknown";
  document.getElementById("tSupplyRaw").textContent = token.totalSupply || "-";
  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const addrEl = document.getElementById("tokenAddressShort");
  addrEl.textContent = short;
  addrEl.dataset.full = address;
}

// ==================================================
// Risk engine (FULLY FIXED)
// ==================================================
function applyRisk(address, token) {
  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];

  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");
  const notes = document.querySelector(".risk-notes");

  riskPill.className = "risk-pill";
  notes.innerHTML = "";

  // Allowlist shortcut
  if (trusted) {
    riskPill.textContent = "🟢 Trusted";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "Trusted token";
    riskDesc.textContent = trusted.note;

    notes.innerHTML = `
      <li>Official allowlisted asset.</li>
      <li>Low risk, still verify via explorer.</li>
    `;
    return;
  }

  // ---------- Heuristic scoring ----------
  let score = 0;

  // Decimals
  if (!token.decimals || token.decimals === 0 || token.decimals > 18) score += 2;

  // Name / symbol quality
  if (!token.name || token.name.length < 3) score += 1;
  if (!token.symbol || token.symbol.length < 2 || token.symbol.length > 8) score += 1;

  // Supply
  try {
    const s = BigInt(token.totalSupply || "0");
    if (s === 0n) score += 2;
    if (s > 10n ** 40n) score += 2;
  } catch {
    score += 1;
  }

  // ---------- Risk level ----------
  if (score === 0) {
    riskPill.textContent = "🟢 Likely Safe";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "No major red flags detected.";
    riskDesc.textContent =
      "Basic heuristics did not find suspicious characteristics.";
  } else if (score <= 2) {
    riskPill.textContent = "⚠️ Caution";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Minor anomalies detected.";
    riskDesc.textContent =
      "Some parameters look unusual but not critical.";
  } else if (score <= 5) {
    riskPill.textContent = "⚠️ Risky";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Multiple risk indicators found.";
    riskDesc.textContent =
      "Proceed only if you understand the token behavior.";
  } else {
    riskPill.textContent = "🔥 High Risk";
    riskPill.classList.add("risk-danger");
    riskTitle.textContent = "Severe red flags detected.";
    riskDesc.textContent =
      "Token appears highly suspicious. Avoid interacting.";
  }

  notes.innerHTML = `
    <li>Heuristic-based analysis only.</li>
    <li>No private APIs or wallet connections.</li>
  `;
}

// ==================================================
// Utils
// ==================================================
function formatSupply(raw, dec) {
  try {
    const v = BigInt(raw);
    const d = BigInt(dec);
    return (v / 10n ** d).toLocaleString();
  } catch {
    return "-";
  }
}
