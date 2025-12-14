// Network configuration
const NETWORKS = {
  arcTestnet: {
    label: "ARC Testnet",
    explorerBase: "https://testnet.arcscan.app"
  }
};

// Trusted tokens list (manual allowlist)
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet",
    refSupply: "25245628768486750"
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
  const body = document.body;

  btn.addEventListener("click", () => {
    const next = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", next);
    btn.textContent = next === "dark" ? "🌙" : "☀️";
  });
}

/* -------------------------
   Copy address
--------------------------*/
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

/* -------------------------
   Contract detection (wallet vs contract)
--------------------------*/
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

/* -------------------------
   Wallet input handling
--------------------------*/
function showWalletInputError() {
  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const explorerLink = document.getElementById("explorerLink");

  tokenCard.classList.add("hidden");
  riskCard.classList.remove("hidden");

  // Hide explorer link for wallets
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

/* -------------------------
   Main handler
--------------------------*/
async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  if (!addr.startsWith("0x")) return alert("Invalid address.");

  const normalized = addr.toLowerCase();
  const explorerLink = document.getElementById("explorerLink");

  // Reset explorer link state
  if (explorerLink) explorerLink.style.display = "none";

  // Wallet vs contract detection (trusted tokens bypass this)
  if (!TRUSTED_TOKENS[normalized]) {
    const isContract = await isContractAddress(addr);
    if (!isContract) {
      showWalletInputError();
      return;
    }
  }

  const resp = await fetch(`/api/arc-token?address=${addr}&network=arcTestnet`);
  const data = await resp.json();

  if (!data || !data.name) {
    alert("Token not found.");
    return;
  }

  fillTokenInfo(addr, data);
  applyRisk(addr, data);

  // Enable explorer link ONLY for valid token contracts
  if (explorerLink) {
    explorerLink.href = `${NETWORKS.arcTestnet.explorerBase}/token/${addr}`;
    explorerLink.textContent = "View on explorer ↗";
    explorerLink.style.display = "inline";
  }

  document.getElementById("tokenCard").classList.remove("hidden");
  document.getElementById("riskCard").classList.remove("hidden");
}

/* -------------------------
   Token info
--------------------------*/
function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent = token.decimals ?? "-";
  document.getElementById("tSupplyRaw").textContent = token.totalSupply || "-";
  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const addrEl = document.getElementById("tokenAddressShort");
  addrEl.textContent = short;
  addrEl.dataset.full = address;
}

/* -------------------------
   Risk engine (unchanged logic)
--------------------------*/
function applyRisk(address, token) {
  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];

  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");

  riskPill.className = "risk-pill";

  if (trusted) {
    riskPill.textContent = "🟢 Trusted";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "Trusted token";
    riskDesc.textContent = trusted.note;

    document.querySelector(".risk-notes").innerHTML = `
      <li>Allowlisted official asset.</li>
      <li>Still verify via official explorer.</li>
    `;
    return;
  }

  riskPill.textContent = "⚠️ Risky";
  riskPill.classList.add("risk-warning");
  riskTitle.textContent = "Heuristic risk detected.";
  riskDesc.textContent = "Token shows unusual characteristics.";
}

/* -------------------------
   Utils
--------------------------*/
function formatSupply(raw, dec) {
  try {
    const v = BigInt(raw);
    const d = BigInt(dec);
    return (v / 10n ** d).toLocaleString();
  } catch {
    return "-";
  }
}
