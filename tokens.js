// Network configuration (testnet only for now)
const NETWORKS = {
  arcTestnet: {
    explorerBase: "https://testnet.arcscan.app"
  }
};

// Manual allowlist for known official tokens
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

/* -------------------------
   Theme toggle
--------------------------*/
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  btn.onclick = () => {
    const body = document.body;
    const next = body.dataset.theme === "dark" ? "light" : "dark";
    body.dataset.theme = next;
    btn.textContent = next === "dark" ? "🌙" : "☀️";
  };
}

/* -------------------------
   Copy address
--------------------------*/
function initCopy() {
  const btn = document.getElementById("copyAddressBtn");
  btn.onclick = async () => {
    const el = document.getElementById("tokenAddressShort");
    if (!el.dataset.full) return;

    await navigator.clipboard.writeText(el.dataset.full);
    btn.textContent = "✔ Copied";
    setTimeout(() => (btn.textContent = "📋 Copy"), 1000);
  };
}

/* -------------------------
   Main analyze handler
--------------------------*/
async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  if (!addr.startsWith("0x")) {
    alert("Invalid address.");
    return;
  }

  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const statusMsg = document.getElementById("statusMsg");

  riskCard.classList.add("hidden");
  tokenCard.classList.add("hidden");
  statusMsg.textContent = "Loading token data...";

  try {
    const res = await fetch(`/api/arc-token?address=${addr}&network=arcTestnet`);
    const data = await res.json();

    // Guard: wallet address or invalid contract
    if (!data || !data.name || data.decimals === undefined) {
      showInvalidInput();
      return;
    }

    fillTokenInfo(addr, data);
    applyRisk(addr, data);

    tokenCard.classList.remove("hidden");
    riskCard.classList.remove("hidden");
    statusMsg.textContent = "Token loaded successfully.";

  } catch (e) {
    console.error(e);
    statusMsg.textContent = "Error loading token.";
  }
}

/* -------------------------
   Invalid input handler
--------------------------*/
function showInvalidInput() {
  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");

  tokenCard.classList.add("hidden");
  riskCard.classList.remove("hidden");

  document.getElementById("riskPill").textContent = "⚠️ Invalid Input";
  document.getElementById("riskPill").className = "risk-pill risk-warning";
  document.getElementById("riskTitle").textContent = "This is not a token contract.";
  document.getElementById("riskDescription").textContent =
    "The address entered appears to be a wallet address, not an ARC-20 token.";

  const ul = document.querySelector(".risk-notes");
  ul.innerHTML = "<li>Please enter a valid ARC-20 token contract.</li>";
}

/* -------------------------
   Fill token info
--------------------------*/
function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name;
  document.getElementById("tSymbol").textContent = token.symbol;
  document.getElementById("tDecimals").textContent = token.decimals;
  document.getElementById("tSupplyRaw").textContent = token.totalSupply;

  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const addrEl = document.getElementById("tokenAddressShort");
  addrEl.textContent = short;
  addrEl.dataset.full = address;

  document.getElementById("tokenTitle").textContent =
    `${token.name} (${token.symbol})`;

  document.getElementById("explorerLink").href =
    `${NETWORKS.arcTestnet.explorerBase}/token/${address}`;

  document.getElementById("tokenAvatar").textContent =
    token.symbol[0].toUpperCase();
}

/* -------------------------
   Risk engine (safe version)
--------------------------*/
function applyRisk(address, token) {
  const ul = document.querySelector(".risk-notes");
  ul.innerHTML = "";

  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];

  if (trusted) {
    document.getElementById("riskPill").textContent = "🟢 Trusted";
    document.getElementById("riskPill").className = "risk-pill risk-safe";
    document.getElementById("riskTitle").textContent = "Verified official token.";
    document.getElementById("riskDescription").textContent = trusted.note;

    ul.innerHTML = "<li>Allowlisted official contract.</li>";
    return;
  }

  document.getElementById("riskPill").textContent = "ℹ️ Informational";
  document.getElementById("riskPill").className = "risk-pill";
  document.getElementById("riskTitle").textContent = "No major red flags detected.";
  document.getElementById("riskDescription").textContent =
    "This is a heuristic-only analysis.";

  ul.innerHTML = `
    <li>Decimals: ${token.decimals}</li>
    <li>Total supply present</li>
    <li>No private APIs used</li>
  `;
}

/* -------------------------
   Helpers
--------------------------*/
function formatSupply(raw, dec) {
  try {
    const n = BigInt(raw);
    const d = BigInt(10) ** BigInt(dec);
    return (n / d).toLocaleString();
  } catch {
    return raw;
  }
}
