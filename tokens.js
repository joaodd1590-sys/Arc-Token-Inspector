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
    // optional reference supply for comparisons
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
   Helper: semantic token check
--------------------------*/
// Checks if the returned metadata actually looks like an ARC-20 token contract
function looksLikeTokenContract(token) {
  return (
    token &&
    token.decimals !== null &&
    token.decimals !== undefined &&
    token.totalSupply !== null &&
    token.totalSupply !== undefined
  );
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
  statusMsg.textContent = "Loading token data from ARC public API...";

  try {
    const resp = await fetch(`/api/arc-token?address=${addr}&network=${network}`);
    const data = await resp.json();

    if (!data || !data.name) {
      statusMsg.textContent =
        "No ARC-20 token metadata found for this address.";
      return;
    }

    fillTokenInfo(addr, data, network);
    tokenCard.classList.remove("hidden");

    // 🚨 SECURITY / UX FIX:
    // If the address does not behave like a token contract,
    // do NOT run the risk engine.
    if (!looksLikeTokenContract(data)) {
      showNotATokenWarning();
      statusMsg.textContent =
        "Address loaded, but it does not appear to be a token contract.";
      return;
    }

    // Run full heuristic engine only for valid token contracts
    applyRisk(addr, data);
    riskCard.classList.remove("hidden");

    statusMsg.textContent =
      "Token loaded successfully. Always confirm with the official explorer.";
  } catch (e) {
    console.error(e);
    statusMsg.textContent = "Error loading token.";
  }
}

/* -------------------------
   Show 'Not a token' state
--------------------------*/
function showNotATokenWarning() {
  const riskCard = document.getElementById("riskCard");
  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");
  const ul = document.querySelector(".risk-notes");
  const verifiedBadge = document.getElementById("verifiedBadge");

  riskCard.classList.remove("hidden");
  verifiedBadge.classList.add("hidden");

  riskPill.className = "risk-pill risk-unknown";
  riskPill.textContent = "ℹ️ Not a token";

  riskTitle.textContent = "Input does not appear to be a token contract.";
  riskDesc.textContent =
    "The provided address looks like a wallet or a non-ARC-20 contract. Risk analysis was intentionally skipped.";

  ul.innerHTML = "";

  [
    "This tool analyzes ARC-20 token contracts only.",
    "Wallet addresses do not expose token metadata such as supply or decimals.",
    "No risk assumptions were made for this address."
  ].forEach((text) => {
    const li = document.createElement("li");
    li.textContent = "• " + text;
    ul.appendChild(li);
  });
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
