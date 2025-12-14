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
// Trusted tokens (ONLY for badge, never as a gate)
// ==================================================
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet",
    refSupply: "25245628768486750"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn")?.addEventListener("click", handleAnalyze);
  document.getElementById("tokenAddress")?.addEventListener("keyup", e => {
    if (e.key === "Enter") handleAnalyze();
  });

  initThemeToggle();
  initCopy();
});

// ==================================================
// Theme toggle (dark / light)
// ==================================================
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  const body = document.body;
  if (!btn) return;

  btn.addEventListener("click", () => {
    const next =
      body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", next);
    btn.textContent = next === "dark" ? "🌙" : "☀️";
  });
}

// ==================================================
// Copy full address
// ==================================================
function initCopy() {
  const btn = document.getElementById("copyAddressBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const el = document.getElementById("tokenAddressShort");
    const full = el?.dataset.full;
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

// ==================================================
// Wallet input UX (clear, non-misleading)
// ==================================================
function showWalletInputError() {
  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const explorerLink = document.getElementById("explorerLink");

  tokenCard?.classList.add("hidden");
  riskCard?.classList.remove("hidden");
  if (explorerLink) explorerLink.style.display = "none";

  document.getElementById("riskPill").className = "risk-pill risk-warning";
  document.getElementById("riskPill").textContent = "⚠️ Invalid input";
  document.getElementById("riskTitle").textContent =
    "Wallet address detected.";
  document.getElementById("riskDescription").textContent =
    "This tool analyzes ARC-20 token contracts only.";

  document.querySelector(".risk-notes").innerHTML = `
    <li>Please enter a valid ARC-20 contract address.</li>
    <li>No token analysis was performed.</li>
  `;
}

// ==================================================
// MAIN ANALYZE HANDLER (CORE LOGIC)
// ==================================================
async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress")?.value.trim();
  if (!addr || !addr.startsWith("0x")) {
    alert("Invalid address.");
    return;
  }

  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const statusMsg = document.getElementById("statusMsg");
  const explorerLink = document.getElementById("explorerLink");

  riskCard?.classList.add("hidden");
  tokenCard?.classList.add("hidden");
  if (explorerLink) explorerLink.style.display = "none";

  if (statusMsg) {
    statusMsg.textContent =
      "Loading token data from ARC public API...";
  }

  try {
    const resp = await fetch(
      `/api/arc-token?address=${addr}&network=arcTestnet`
    );
    const data = await resp.json();

    // 🔐 ONLY real wallet vs token check
    if (!data || !data.name || !data.symbol) {
      showWalletInputError();
      return;
    }

    fillTokenInfo(addr, data);
    applyRisk(addr, data);

    if (explorerLink) {
      explorerLink.href =
        `${NETWORKS.arcTestnet.explorerBase}/token/${addr}`;
      explorerLink.textContent = "View on explorer ↗";
      explorerLink.style.display = "inline";
    }

    tokenCard?.classList.remove("hidden");
    riskCard?.classList.remove("hidden");

    if (statusMsg) {
      statusMsg.textContent =
        "Token loaded successfully. Always confirm with the official explorer.";
    }
  } catch (err) {
    console.error(err);
    if (statusMsg) statusMsg.textContent = "Error loading token.";
  }
}

// ==================================================
// Token info rendering
// ==================================================
function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent =
    token.decimals ?? "unknown";
  document.getElementById("tSupplyRaw").textContent =
    token.totalSupply || "-";

  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const addrEl = document.getElementById("tokenAddressShort");
  addrEl.textContent = short;
  addrEl.dataset.full = address;
}

// ==================================================
// Risk engine (heuristic, read-only)
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

  // Trusted badge (cosmetic only)
  if (trusted) {
    riskPill.textContent = "🟢 Trusted";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "Trusted token";
    riskDesc.textContent = trusted.note;

    notes.innerHTML = `
      <li>Allowlisted official asset.</li>
      <li>Still verify via the official explorer.</li>
    `;
    return;
  }

  // Basic heuristic fallback
  riskPill.textContent = "⚠️ Risky";
  riskPill.classList.add("risk-warning");
  riskTitle.textContent = "Heuristic risk detected.";
  riskDesc.textContent =
    "Token shows unusual or incomplete on-chain characteristics.";

  notes.innerHTML = `
    <li>Token metadata may be incomplete or non-standard.</li>
    <li>No verification status available on testnet.</li>
    <li>Heuristic only — always verify manually.</li>
  `;
}

// ==================================================
// Utils
// ==================================================
function formatSupply(raw, dec) {
  try {
    const v = BigInt(raw);
    const d = BigInt(dec || 0);
    if (d === 0n) return v.toLocaleString();
    return (v / 10n ** d).toLocaleString();
  } catch {
    return "-";
  }
}
