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
// Wallet UX
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
    <li>No ERC-20 metadata found.</li>
    <li>Please enter a valid token contract address.</li>
  `;
}

// ==================================================
// Main handler (FIXED LOGIC)
// ==================================================
async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  if (!addr.startsWith("0x")) return alert("Invalid address.");

  const explorerLink = document.getElementById("explorerLink");

  if (explorerLink) explorerLink.style.display = "none";

  // Always fetch token metadata FIRST
  const resp = await fetch(`/api/arc-token?address=${addr}&network=arcTestnet`);
  const data = await resp.json();

  // If no ERC-20 metadata → treat as wallet / invalid
  if (!data || !data.name || !data.symbol || data.decimals === undefined) {
    showWalletInputError();
    return;
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
  document.getElementById("tName").textContent = token.name;
  document.getElementById("tSymbol").textContent = token.symbol;
  document.getElementById("tDecimals").textContent = token.decimals;
  document.getElementById("tSupplyRaw").textContent = token.totalSupply || "-";
  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const addrEl = document.getElementById("tokenAddressShort");
  addrEl.textContent = short;
  addrEl.dataset.full = address;
}

// ==================================================
// Risk engine (unchanged behavior, now correct input)
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

  let score = 0;

  if (token.decimals === 0 || token.decimals > 18) score += 2;
  if (!token.name || token.name.length < 3) score += 1;
  if (!token.symbol || token.symbol.length > 8) score += 1;

  if (score === 0) {
    riskPill.textContent = "🟢 Likely Safe";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "No major red flags detected.";
    riskDesc.textContent = "Token structure looks standard.";
  } else {
    riskPill.textContent = "⚠️ Risky";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Heuristic risk detected.";
    riskDesc.textContent = "Token shows unusual characteristics.";
  }

  notes.innerHTML = `
    <li>Read-only heuristic analysis.</li>
    <li>No wallet connection required.</li>
  `;
}

// ==================================================
// Utils
// ==================================================
function formatSupply(raw, dec) {
  try {
    return (BigInt(raw) / 10n ** BigInt(dec)).toLocaleString();
  } catch {
    return "-";
  }
}
