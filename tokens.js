// ================================
// Network configuration
// ================================
const NETWORKS = {
  arcTestnet: {
    label: "ARC Testnet",
    explorerBase: "https://testnet.arcscan.app"
  }
};

// ================================
// Optional trusted tokens (badge only)
// ================================
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

// ================================
// Theme toggle
// ================================
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  const body = document.body;

  btn.addEventListener("click", () => {
    const next = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", next);
    btn.textContent = next === "dark" ? "🌙" : "☀️";
  });
}

// ================================
// Copy address
// ================================
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

// ================================
// Wallet / invalid token UI
// ================================
function showNotAToken(address) {
  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");

  tokenCard.classList.add("hidden");
  riskCard.classList.remove("hidden");

  document.getElementById("riskPill").className = "risk-pill risk-warning";
  document.getElementById("riskPill").textContent = "⚠️ Invalid input";

  document.getElementById("riskTitle").textContent =
    "Not a token contract.";

  document.getElementById("riskDescription").textContent =
    "The provided address does not expose ARC-20 token metadata. It may be a wallet or a non-token contract.";

  document.querySelector(".risk-notes").innerHTML = `
    <li>This tool analyzes ARC-20 token contracts only.</li>
    <li>No heuristic analysis was performed.</li>
  `;
}

// ================================
// Main handler
// ================================
async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  if (!addr.startsWith("0x")) {
    alert("Invalid address format.");
    return;
  }

  const normalized = addr.toLowerCase();
  const network = "arcTestnet";

  document.getElementById("riskCard").classList.add("hidden");
  document.getElementById("tokenCard").classList.add("hidden");

  let data;
  try {
    const resp = await fetch(`/api/arc-token?address=${addr}&network=${network}`);
    data = await resp.json();
  } catch {
    showNotAToken(addr);
    return;
  }

  // 🔴 CRITICAL FIX:
  // If token metadata does not exist → NOT A TOKEN
  if (
    !data ||
    !data.name ||
    !data.symbol ||
    data.decimals === undefined
  ) {
    showNotAToken(addr);
    return;
  }

  fillTokenInfo(addr, data, network);
  applyRisk(addr, data);

  document.getElementById("tokenCard").classList.remove("hidden");
  document.getElementById("riskCard").classList.remove("hidden");
}

// ================================
// Token info
// ================================
function fillTokenInfo(address, token, networkKey) {
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

  const explorer = NETWORKS[networkKey].explorerBase;
  const link = document.getElementById("explorerLink");
  link.href = `${explorer}/token/${address}`;
  link.style.display = "inline";
}

// ================================
// Risk engine
// ================================
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
    notes.innerHTML = `<li>Allowlisted official asset.</li>`;
    return;
  }

  let score = 0;

  if (Number(token.decimals) === 0) score += 2;
  if (!token.totalSupply || token.totalSupply === "0") score += 2;

  if (score >= 4) {
    riskPill.textContent = "⚠️ Risky";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Several red flags detected.";
    riskDesc.textContent = "Token metadata shows non-standard patterns.";
  } else {
    riskPill.textContent = "🟢 Likely Safe";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "No major red flags detected.";
    riskDesc.textContent = "Token structure looks standard.";
  }

  notes.innerHTML = `
    <li>Read-only heuristic analysis.</li>
    <li>No wallet connection required.</li>
  `;
}

// ================================
// Utils
// ================================
function formatSupply(raw, dec) {
  try {
    const v = BigInt(raw);
    const d = BigInt(dec);
    return (v / 10n ** d).toLocaleString();
  } catch {
    return "-";
  }
}
