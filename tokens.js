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
      statusMsg.textContent = "Token not found.";
      return;
    }

    fillTokenInfo(addr, data, network);
    applyRisk(addr, data); // full heuristic engine

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

  // reset visual state
  riskPill.className = "risk-pill";
  verifiedBadge.classList.add("hidden");

  const breakdown = [];
  let totalScore = 0;

  /* ------------------------------------------------
     If token is allowlisted → automatically Trusted
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

  /* ------------------------------------------------
     DECIMALS CHECK
  --------------------------------------------------*/
  let decimalsScore = 0;
  const decimals = Number(token.decimals || 0);

  if (decimals > 18 || decimals === 0) decimalsScore += 2;

  breakdown.push({
    label: "Decimals",
    score: decimalsScore,
    icon: decimalsScore ? "⚠️" : "✅",
    reason:
      decimals === 0
        ? "Token has 0 decimals — unusual for ERC-20 assets."
        : decimals > 18
        ? "Very high decimals — often used in misleading tokens."
        : "Decimals appear normal."
  });

  totalScore += decimalsScore;

  /* ------------------------------------------------
     NAME / SYMBOL QUALITY
  --------------------------------------------------*/
  let nameSymbolScore = 0;
  const name = token.name || "";
  const symbol = token.symbol || "";

  if (!name || name.length < 3) nameSymbolScore += 1;
  if (!symbol || symbol.length < 2 || symbol.length > 8) nameSymbolScore += 1;

  breakdown.push({
    label: "Name / Symbol",
    score: nameSymbolScore,
    icon: nameSymbolScore ? "⚠️" : "✅",
    reason:
      nameSymbolScore > 0
        ? "Unusual name or symbol length/format."
        : "Name and symbol look well-structured."
  });

  /* ------------------------------------------------
     IMPERSONATION ATTEMPT (famous symbols)
  --------------------------------------------------*/
  const famousSymbols = ["USDC", "USDT", "ETH", "BTC", "BNB", "ARB", "MATIC"];
  let impersonationScore = 0;

  if (famousSymbols.includes(symbol.toUpperCase())) {
    impersonationScore += 3;
  }

  breakdown.push({
    label: "Impersonation",
    score: impersonationScore,
    icon: impersonationScore ? "🚩" : "✅",
    reason:
      impersonationScore > 0
        ? `Symbol matches a well-known asset (${symbol}). Could be impersonation.`
        : "No impersonation indicators."
  });

  totalScore += nameSymbolScore + impersonationScore;

  /* ------------------------------------------------
     SUPPLY CHECK
  --------------------------------------------------*/
  let supplyScore = 0;
  const supplyStr = token.totalSupply || "0";
  let supply = 0n;
  try {
    supply = BigInt(supplyStr);
  } catch {}

  if (supply === 0n) supplyScore += 2;
  if (supply > 10n ** 40n) supplyScore += 2;

  breakdown.push({
    label: "Total supply",
    score: supplyScore,
    icon: supplyScore ? "⚠️" : "✅",
    reason:
      supply === 0n
        ? "Total supply is zero — token may be broken."
        : supply > 10n ** 40n
        ? "Extremely large supply — common red flag."
        : "Supply looks normal."
  });

  totalScore += supplyScore;

  /* ------------------------------------------------
     ADDRESS PATTERN
  --------------------------------------------------*/
  let addrScore = 0;
  if (normalized.startsWith("0x000000")) addrScore += 2;

  breakdown.push({
    label: "Address pattern",
    score: addrScore,
    icon: addrScore ? "⚠️" : "✅",
    reason:
      addrScore > 0
        ? "Contract starts with many zeros — often vanity or deceptive patterns."
        : "Nothing unusual about the address format."
  });

  totalScore += addrScore;

  /* ------------------------------------------------
     PLACEHOLDER CHECKS (Testnet limitations)
  --------------------------------------------------*/

  breakdown.push({
    label: "Contract verification",
    score: 0,
    icon: "ℹ️",
    reason: "Testnet API does not expose verification status."
  });

  breakdown.push({
    label: "Honeypot checks",
    score: 0,
    icon: "ℹ️",
    reason: "Honeypot simulation is not available on testnet."
  });

  breakdown.push({
    label: "Creation age",
    score: 0,
    icon: "ℹ️",
    reason: "Contract age info unavailable on this endpoint."
  });

  /* ------------------------------------------------
     RISK LEVEL BY SCORE
  --------------------------------------------------*/
  let level = "safe";
  if (totalScore >= 8) level = "danger";
  else if (totalScore >= 4) level = "warning";
  else if (totalScore >= 1) level = "caution";

  if (level === "safe") {
    riskPill.textContent = "🟢 Likely Safe";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "No major red flags detected.";
    riskDesc.textContent =
      "Basic heuristics found no severe issues. Still not a safety guarantee.";
  } else if (level === "caution") {
    riskPill.textContent = "⚠️ Caution";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Minor unusual characteristics found.";
    riskDesc.textContent =
      "Some elements (decimals, naming, supply) look slightly off.";
  } else if (level === "warning") {
    riskPill.textContent = "⚠️ Risky";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Several red flags detected.";
    riskDesc.textContent =
      "Interact only if you fully understand the project and risks.";
  } else {
    riskPill.textContent = "🔥 High Risk";
    riskPill.classList.add("risk-danger", "glow-danger");
    riskTitle.textContent = "Severe risk indicators detected.";
    riskDesc.textContent =
      "Token appears extremely suspicious. Avoid interacting.";
  }

  renderRiskNotes(level, totalScore, breakdown);
}

/* ------------------------------------------------
   Render bullet list: "Why this rating?"
--------------------------------------------------*/
function renderRiskNotes(level, totalScore, breakdown) {
  const ul = document.querySelector(".risk-notes");
  if (!ul) return;

  let levelLabel =
    level === "safe"
      ? "Likely Safe"
      : level === "caution"
      ? "Caution"
      : level === "warning"
      ? "Risky"
      : "High Risk";

  ul.innerHTML = "";

  const headerLi = document.createElement("li");
  headerLi.innerHTML = `<strong>Why this rating? (${levelLabel}, score ${totalScore})</strong>`;
  ul.appendChild(headerLi);

  breakdown.forEach((b) => {
    const li = document.createElement("li");
    li.innerHTML = `${b.icon} <strong>${b.label}:</strong> ${b.reason} ${
      b.score ? `(score +${b.score})` : ""
    }`;
    ul.appendChild(li);
  });

  // Standard disclaimers
  const liHeuristic = document.createElement("li");
  liHeuristic.textContent =
    "Heuristic only — always verify the contract manually.";
  ul.appendChild(liHeuristic);

  const liPublic = document.createElement("li");
  liPublic.textContent =
    "No private APIs used, only public on-chain metadata.";
  ul.appendChild(liPublic);
}
