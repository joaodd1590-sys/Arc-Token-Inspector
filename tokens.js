// ==============================
// Network config
// ==============================
const NETWORKS = {
  arcTestnet: {
    label: "ARC Testnet",
    explorerBase: "https://testnet.arcscan.app",
    apiBase: "https://testnet.arcscan.app/api"
  }
};

// ==============================
// DOM Ready
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
  document.getElementById("tokenAddress").addEventListener("keyup", e => {
    if (e.key === "Enter") handleAnalyze();
  });

  initThemeToggle();
  initCopy();
});

// ==============================
// Theme toggle
// ==============================
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  btn.addEventListener("click", () => {
    const body = document.body;
    const next = body.dataset.theme === "dark" ? "light" : "dark";
    body.dataset.theme = next;
    btn.textContent = next === "dark" ? "🌙" : "☀️";
  });
}

// ==============================
// Copy address
// ==============================
function initCopy() {
  const btn = document.getElementById("copyAddressBtn");
  btn.addEventListener("click", async () => {
    const el = document.getElementById("tokenAddressShort");
    if (!el?.dataset.full) return;

    await navigator.clipboard.writeText(el.dataset.full);
    btn.textContent = "✔ Copied";
    setTimeout(() => (btn.textContent = "📋 Copy"), 1000);
  });
}

// ==============================
// Check if token exists on ArcScan
// ==============================
async function tokenExistsOnArcScan(address) {
  try {
    const res = await fetch(
      `${NETWORKS.arcTestnet.apiBase}?module=token&action=tokeninfo&contractaddress=${address}`
    );
    const json = await res.json();

    // ArcScan returns status === "1" when token exists
    return json.status === "1" && Array.isArray(json.result);
  } catch {
    return false;
  }
}

// ==============================
// Wallet / invalid input UI
// ==============================
function showInvalidInput() {
  document.getElementById("tokenCard").classList.add("hidden");
  document.getElementById("riskCard").classList.remove("hidden");

  document.getElementById("riskPill").className = "risk-pill risk-warning";
  document.getElementById("riskPill").textContent = "⚠️ Invalid input";

  document.getElementById("riskTitle").textContent =
    "Address is not an ARC-20 token";

  document.getElementById("riskDescription").textContent =
    "This address does not appear in the ARC Testnet token registry.";

  document.querySelector(".risk-notes").innerHTML = `
    <li>The address is likely a wallet or non-token contract.</li>
    <li>Only ARC-20 token contracts can be analyzed.</li>
  `;
}

// ==============================
// Main handler
// ==============================
async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    alert("Invalid address format.");
    return;
  }

  showLoadingState();

  const exists = await tokenExistsOnArcScan(addr);
  if (!exists) {
    hideLoadingState();
    showInvalidInput();
    return;
  }

  // Fetch token metadata
  const resp = await fetch(`/api/arc-token?address=${addr}&network=arcTestnet`);
  const data = await resp.json();

  hideLoadingState();

  fillTokenInfo(addr, data);
  applyRisk(addr, data);

  document.getElementById("tokenCard").classList.remove("hidden");
  document.getElementById("riskCard").classList.remove("hidden");
}

// ==============================
// Loading UX
// ==============================
function showLoadingState() {
  document.getElementById("statusMsg").textContent =
    "Checking ARC token registry…";
}

function hideLoadingState() {
  document.getElementById("statusMsg").textContent = "";
}

// ==============================
// Token info
// ==============================
function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name || "Unknown";
  document.getElementById("tSymbol").textContent = token.symbol || "—";
  document.getElementById("tDecimals").textContent = token.decimals ?? "—";
  document.getElementById("tSupplyRaw").textContent = token.totalSupply || "—";
  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const el = document.getElementById("tokenAddressShort");
  el.textContent = short;
  el.dataset.full = address;

  const link = document.getElementById("explorerLink");
  link.href = `${NETWORKS.arcTestnet.explorerBase}/token/${address}`;
  link.style.display = "inline";
}

// ==============================
// Risk engine (SAFE DEFAULT)
// ==============================
function applyRisk(_, token) {
  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");

  let score = 0;

  if (!token.decimals || Number(token.decimals) === 0) score += 1;
  if (!token.totalSupply || token.totalSupply === "0") score += 1;

  if (score === 0) {
    riskPill.textContent = "🟢 Likely Safe";
    riskPill.className = "risk-pill risk-safe";
    riskTitle.textContent = "No major red flags detected.";
    riskDesc.textContent = "Token structure looks standard.";
  } else {
    riskPill.textContent = "⚠️ Caution";
    riskPill.className = "risk-pill risk-warning";
    riskTitle.textContent = "Some unusual characteristics found.";
    riskDesc.textContent =
      "This does not mean the token is malicious, but requires caution.";
  }
}

// ==============================
// Utils
// ==============================
function formatSupply(raw, dec) {
  try {
    const v = BigInt(raw);
    const d = BigInt(dec);
    return (v / 10n ** d).toLocaleString();
  } catch {
    return "—";
  }
}
