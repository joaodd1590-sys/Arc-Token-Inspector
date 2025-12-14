// Network configuration (I only enable Testnet for now. Mainnet will be opened later.)
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

// Trusted tokens list (manual allowlist for known official contracts)
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

/* -------------------------
   Theme switch (dark/light)
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
   Copy full contract address
--------------------------*/
function initCopy() {
  const btn = document.getElementById("copyAddressBtn");
  btn.addEventListener("click", async () => {
    const full = document.getElementById("tokenAddressShort").dataset.full;
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

/* -------------------------
   Check if address is a contract (not a wallet)
--------------------------*/
async function isContractAddress(address, networkKey) {
  const explorer = NETWORKS[networkKey].explorerBase;

  try {
    const res = await fetch(
      `${explorer}/api?module=proxy&action=eth_getCode&address=${address}&tag=latest`
    );
    const json = await res.json();

    // Wallets return empty bytecode ("0x")
    return json.result && json.result !== "0x";
  } catch (e) {
    console.error("Contract detection failed", e);
    return false;
  }
}

/* -------------------------
   Handle wallet input explicitly
--------------------------*/
function showWalletInputError() {
  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const statusMsg = document.getElementById("statusMsg");

  tokenCard.classList.add("hidden");
  riskCard.classList.remove("hidden");

  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");
  const ul = document.querySelector(".risk-notes");

  riskPill.className = "risk-pill risk-warning";
  riskPill.textContent = "⚠️ Invalid input";

  riskTitle.textContent = "Wallet address detected.";
  riskDesc.textContent =
    "This tool analyzes ARC-20 token contracts only. Wallet addresses are not supported.";

  ul.innerHTML = `
    <li>Please enter a valid ARC-20 contract address.</li>
    <li>No token analysis was performed.</li>
  `;

  statusMsg.textContent =
    "Input is a wallet address, not a token contract.";
}

/* -------------------------
   Main "Analyze" handler
--------------------------*/
async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  if (!addr || !addr.startsWith("0x")) {
    alert("Invalid address.");
    return;
  }

  // Mainnet remains disabled in the UI. Analysis always runs on Testnet only.
  const network = "arcTestnet";

  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const statusMsg = document.getElementById("statusMsg");

  riskCard.classList.add("hidden");
  tokenCard.classList.add("hidden");
  statusMsg.textContent = "Checking address type...";

  // HARD CHECK: wallet vs contract
  const normalized = addr.toLowerCase();

// Allowlisted tokens always bypass contract detection
if (!TRUSTED_TOKENS[normalized]) {
  const isContract = await isContractAddress(addr, network);
  if (!isContract) {
    showWalletInputError();
    return;
  }
}


  statusMsg.textContent = "Loading token data from ARC public API...";

  try {
    const resp = await fetch(`/api/arc-token?address=${addr}&network=${network}`);
    const data = await resp.json();

    if (!data || !data.name) {
      statusMsg.textContent = "Token not found.";
      return;
    }

    fillTokenInfo(addr, data, network);
    applyRisk(addr, data);

    tokenCard.classList.remove("hidden");
    riskCard.classList.remove("hidden");
    statusMsg.textContent =
      "Token loaded successfully. Always confirm with the official explorer.";
  } catch (e) {
    console.error(e);
    statusMsg.textContent = "Error loading token.";
  }
}

/* -------------------------
   Populate token info card
--------------------------*/
function fillTokenInfo(address, token, networkKey) {
  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent =
    token.decimals ?? "unknown";
  document.getElementById("tSupplyRaw").textContent =
    token.totalSupply || "-";

  const short = shorten(address);
  const full = document.getElementById("tokenAddressShort");
  full.textContent = short;
  full.dataset.full = address;

  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  document.getElementById("tokenTitle").textContent =
    `${token.name || "Token"} (${token.symbol || "?"})`;

  const explorer = NETWORKS[networkKey].explorerBase;
  document.getElementById("explorerLink").href =
    `${explorer}/token/${address}`;

  document.getElementById("tokenAvatar").textContent =
    (token.symbol?.[0] || "?").toUpperCase();
}

/* -------------------------
   Helper: short address
--------------------------*/
function shorten(a) {
  if (!a || a.length < 10) return a;
  return a.slice(0, 6) + "..." + a.slice(-4);
}

/* -------------------------
   Format supply as human-readable
--------------------------*/
function formatSupply(raw, dec) {
  if (!raw) return "-";
  try {
    const big = BigInt(raw);
    const d = BigInt(dec || 0);
    if (d === 0n) return big.toLocaleString();

    const f = BigInt(10) ** d;
    const intPart = big / f;
    const fracPart = big % f;

    return `${intPart.toLocaleString()}.${
      fracPart.toString().padStart(Number(d), "0").slice(0, 4)
    }`;
  } catch {
    return raw;
  }
}

/* ============================================================
   FULL RISK ENGINE (NO GRAPHS, ONLY TEXTUAL BREAKDOWN)
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

  /* ------------------------------------------------
     Trusted allowlist shortcut
  --------------------------------------------------*/
  if (trusted) {
    riskPill.textContent = "🟢 Trusted";
    riskPill.classList.add("risk-safe");
    verifiedBadge.classList.remove("hidden");

    riskTitle.textContent = `${token.symbol || "Token"} is allowlisted.`;
    riskDesc.textContent =
      trusted.note + " · Still, always verify links and metadata.";

    breakdown.push({
      label: "Trusted list",
      score: 0,
      icon: "🟢",
      reason: "This contract is explicitly listed as an official asset."
    });

    renderRiskNotes("safe", totalScore, breakdown);
    return;
  }

  /* -------- rest of your risk engine remains unchanged -------- */

  // (Everything below is identical to your original logic)
  // ... no changes here ...
}
