// Network config
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

// Trusted tokens
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
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
    const full = document.getElementById("tokenAddressShort").dataset.full;
    if (!full) return;
    await navigator.clipboard.writeText(full);
    btn.textContent = "✔ Copied";
    setTimeout(() => (btn.textContent = "📋 Copy"), 1000);
  });
}

async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  if (!addr || !addr.startsWith("0x")) {
    alert("Invalid address.");
    return;
  }

  const network = "arcTestnet"; // mainnet bloqueado no HTML

  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  riskCard.classList.add("hidden");
  tokenCard.classList.add("hidden");

  try {
    const resp = await fetch(`/api/arc-token?address=${addr}&network=${network}`);
    const data = await resp.json();

    if (!data || !data.name) {
      document.getElementById("statusMsg").textContent = "Token not found.";
      return;
    }

    fillTokenInfo(addr, data, network);
    applyRisk(addr, data);

    tokenCard.classList.remove("hidden");
    riskCard.classList.remove("hidden");
  } catch (e) {
    document.getElementById("statusMsg").textContent = "Error loading token.";
  }
}


// -----------------------------------------------------
// TOKEN INFO
// -----------------------------------------------------

function fillTokenInfo(address, token, networkKey) {
  document.getElementById("tName").textContent = token.name;
  document.getElementById("tSymbol").textContent = token.symbol;
  document.getElementById("tDecimals").textContent = token.decimals;
  document.getElementById("tSupplyRaw").textContent = token.totalSupply;

  const short = shorten(address);
  const full = document.getElementById("tokenAddressShort");
  full.textContent = short;
  full.dataset.full = address;

  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  document.getElementById("tokenTitle").textContent =
    `${token.name} (${token.symbol})`;

  const explorer = NETWORKS[networkKey].explorerBase;
  document.getElementById("explorerLink").href =
    `${explorer}/token/${address}`;

  document.getElementById("tokenAvatar").textContent =
    (token.symbol?.[0] || "?").toUpperCase();
}

function shorten(a) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function formatSupply(raw, dec) {
  if (!raw) return "-";
  try {
    const big = BigInt(raw);
    const d = BigInt(dec || 0);
    const f = BigInt(10) ** d;
    return `${(big / f).toLocaleString()}.${
      (big % f).toString().padStart(Number(dec), "0").slice(0, 4)
    }`;
  } catch {
    return raw;
  }
}


// -----------------------------------------------------
// RISK ENGINE — versão PRO
// -----------------------------------------------------

const FAMOUS_TOKENS = ["USDC", "USDT", "ETH", "BTC", "BNB", "WETH", "ARB"];

function applyRisk(address, token) {
  const pill = document.getElementById("riskPill");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");
  const badge = document.getElementById("verifiedBadge");

  pill.className = "risk-pill";
  badge.classList.add("hidden");

  const lower = address.toLowerCase();

  // TRUSTED TOKENS
  if (TRUSTED_TOKENS[lower]) {
    pill.textContent = "Trusted";
    pill.classList.add("risk-safe");
    badge.classList.remove("hidden");
    title.textContent = "This token is verified & trusted.";
    desc.textContent = TRUSTED_TOKENS[lower].note;
    return;
  }

  // ---------------------------
  // RISK SCORE CALCULATION
  // ---------------------------
  let score = 0;
  let reasons = [];

  // 1. Decimals
  if (token.decimals === 0 || token.decimals > 18) {
    score += 2;
    reasons.push("⚠ Decimals unusual.");
  }

  // 2. Total supply
  if (token.totalSupply === "0") {
    score += 3;
    reasons.push("⚠ Total supply is zero.");
  }

  try {
    if (BigInt(token.totalSupply) > 10n ** 20n) {
      score += 3;
      reasons.push("⚠ Supply extremely high.");
    }
  } catch {}

  // 3. Impersonation
  if (FAMOUS_TOKENS.includes(token.symbol?.toUpperCase())) {
    score += 3;
    reasons.push("⚠ Symbol matches a famous token (possible impersonation).");
  }

  // 4. Address pattern suspicious
  if (/(00000000|fffffff)/.test(address)) {
    score += 2;
    reasons.push("⚠ Address contains suspicious patterns.");
  }

  // 5. Contract verification (future)
  if (token.verified === false) {
    score += 3;
    reasons.push("⚠ Contract is NOT verified.");
  }

  // 6. Honeypot simulation (fallback)
  if (token.honeypot === true) {
    score += 4;
    reasons.push("🔥 Honeypot behavior detected.");
  }

  // ---------------------------
  // APPLY VISUAL RISK STATE
  // ---------------------------
  if (score <= 1) {
    pill.textContent = "Likely Safe";
    pill.classList.add("risk-safe");
    title.textContent = "This token appears safe.";
  } 
  else if (score <= 4) {
    pill.textContent = "Caution";
    pill.classList.add("risk-warning");
    title.textContent = "Some mild warnings detected.";
  } 
  else if (score <= 7) {
    pill.textContent = "Risky";
    pill.classList.add("risk-danger");
    title.textContent = "Multiple suspicious factors found.";
  } 
  else {
    pill.textContent = "High Risk";
    pill.classList.add("risk-danger", "glow-danger");
    title.textContent = "High-risk token. Avoid interacting!";
  }

  // Description
  desc.innerHTML = reasons.length
    ? reasons.map(r => `• ${r}`).join("<br>")
    : "No major red flags detected.";
}
