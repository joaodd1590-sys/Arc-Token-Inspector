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
    note: "Official USDC on ARC Testnet",
    // opcional: supply de referência
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

async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  if (!addr || !addr.startsWith("0x")) {
    alert("Invalid address.");
    return;
  }

  // mainnet continua bloqueado no HTML, aqui só usamos testnet
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
    applyRisk(addr, data); // agora com heurística completa

    tokenCard.classList.remove("hidden");
    riskCard.classList.remove("hidden");
    statusMsg.textContent =
      "Token loaded successfully. Always cross-check with the official explorer.";
  } catch (e) {
    console.error(e);
    statusMsg.textContent = "Error loading token.";
  }
}

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

function shorten(a) {
  if (!a || a.length < 10) return a;
  return a.slice(0, 6) + "..." + a.slice(-4);
}

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

/* ---------------------------------------
   RISK ENGINE COMPLETO (SEM GRÁFICOS)
---------------------------------------- */

function applyRisk(address, token) {
  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];

  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");
  const verifiedBadge = document.getElementById("verifiedBadge");

  // reset estado visual
  riskPill.className = "risk-pill";
  verifiedBadge.classList.add("hidden");

  const breakdown = [];
  let totalScore = 0;

  /* ========= TRUSTED (ALLOWLIST) ========= */
  if (trusted) {
    riskPill.textContent = "🟢 Trusted";
    riskPill.classList.add("risk-safe");
    verifiedBadge.classList.remove("hidden");

    riskTitle.textContent = `${token.symbol || "Token"} is marked as trusted.`;
    riskDesc.textContent =
      trusted.note +
      " · Still, always verify URLs, contracts and documentation.";

    breakdown.push({
      label: "Trusted list",
      score: 0,
      icon: "🟢",
      reason: "This contract is explicitly allowlisted as an official token."
    });

    renderRiskNotes("safe", totalScore, breakdown);
    return;
  }

  // --------- DECIMALS ----------
  let decimalsScore = 0;
  const decimals = Number(token.decimals || 0);
  if (decimals > 18 || decimals === 0) {
    decimalsScore += 2;
  }
  breakdown.push({
    label: "Decimals",
    score: decimalsScore,
    icon: decimalsScore ? "⚠️" : "✅",
    reason:
      decimals === 0
        ? "Token has 0 decimals — unusual for most mainstream ERC-20 tokens."
        : decimals > 18
        ? "Token uses very high decimals — can be used to mislead users."
        : "Decimals in a typical range."
  });
  totalScore += decimalsScore;

  // --------- NAME / SYMBOL ----------
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
        ? "Name and/or symbol look unusually short/long for typical tokens."
        : "Name and symbol look reasonably structured."
  });

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
        ? `Symbol matches a well-known asset (${symbol}) — possible impersonation if this is not an official contract.`
        : "No obvious symbol impersonation detected."
  });

  totalScore += nameSymbolScore + impersonationScore;

  // --------- SUPPLY ----------
  let supplyScore = 0;
  const supplyStr = token.totalSupply || "0";
  let supply = 0n;
  try {
    supply = BigInt(supplyStr);
  } catch {
    // se der erro, deixa 0
  }

  if (supply === 0n) supplyScore += 2;
  if (supply > 10n ** 40n) supplyScore += 2;

  breakdown.push({
    label: "Total supply",
    score: supplyScore,
    icon: supplyScore ? "⚠️" : "✅",
    reason:
      supply === 0n
        ? "Total supply is zero — token may be defunct or misconfigured."
        : supply > 10n ** 40n
        ? "Extremely large supply — comum em tokens de baixa qualidade ou spam."
        : "Supply looks within a normal range for ERC-20 style assets."
  });
  totalScore += supplyScore;

  // --------- ADDRESS PATTERN ----------
  let addrScore = 0;
  if (normalized.startsWith("0x000000")) addrScore += 2;

  breakdown.push({
    label: "Address pattern",
    score: addrScore,
    icon: addrScore ? "⚠️" : "✅",
    reason:
      addrScore > 0
        ? "Contract address starts with many zeros — pode ter sido escolhido para parecer 'especial' e enganar usuários."
        : "Contract address pattern is not inherently suspicious."
  });
  totalScore += addrScore;

  // --------- ABI / VERIFICATION (placeholder testnet) ----------
  const abiScore = 0;
  breakdown.push({
    label: "Contract verification",
    score: abiScore,
    icon: "ℹ️",
    reason:
      "Verification status is not available on this testnet endpoint. On mainnet, a non-verified contract would be a strong red flag."
  });

  // --------- HONEYPOT (placeholder) ----------
  const honeypotScore = 0;
  breakdown.push({
    label: "Honeypot checks",
    score: honeypotScore,
    icon: "ℹ️",
    reason:
      "Static honeypot analysis (buy/sell simulation, blacklist checks) is not enabled on this testnet version."
  });

  // --------- CREATION TIME (placeholder) ----------
  const creationScore = 0;
  breakdown.push({
    label: "Creation age",
    score: creationScore,
    icon: "ℹ️",
    reason:
      "Creation block / age data is not exposed by this API on testnet. On mainnet, extremely new contracts are usually higher risk."
  });

  totalScore += abiScore + honeypotScore + creationScore;

  // --------- SCORE → LEVEL ----------
  let level = "safe";
  if (totalScore >= 8) level = "danger";
  else if (totalScore >= 4) level = "warning";
  else if (totalScore >= 1) level = "caution";

  if (level === "safe") {
    riskPill.textContent = "🟢 Likely Safe";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "No major heuristic red flags detected.";
    riskDesc.textContent =
      "This does NOT guarantee safety — it only means basic structural checks did not find severe issues. Always do your own research.";
  } else if (level === "caution") {
    riskPill.textContent = "⚠️ Caution";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Minor suspicious characteristics detected.";
    riskDesc.textContent =
      "Some aspects (decimals, naming or supply) look slightly unusual. Review this contract carefully before interacting.";
  } else if (level === "warning") {
    riskPill.textContent = "⚠️ Risky";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Several heuristic red flags were found.";
    riskDesc.textContent =
      "The token's configuration suggests higher-than-normal risk. Interact only if you fully understand the project.";
  } else {
    riskPill.textContent = "🔥 High Risk";
    riskPill.classList.add("risk-danger", "glow-danger");
    riskTitle.textContent = "Strong red flags — avoid this token.";
    riskDesc.textContent =
      "Based on decimals, supply, naming and address pattern, this token looks extremely risky. Avoid interacting.";
  }

  renderRiskNotes(level, totalScore, breakdown);
}

/* ---------------------------------------
   RENDER DA LISTA "WHY THIS RATING?"
   usando a UL .risk-notes que já existe
---------------------------------------- */

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

  // Título dentro da lista (mantém o mesmo layout de UL)
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

  // disclaimers originais do site
  const liHeuristic = document.createElement("li");
  liHeuristic.textContent =
    "Heuristic only — always double-check the contract yourself.";
  ul.appendChild(liHeuristic);

  const liPublic = document.createElement("li");
  liPublic.textContent =
    "No private APIs, only public on-chain data & basic rules.";
  ul.appendChild(liPublic);
}
