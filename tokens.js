// Network configuration (future-proof for mainnet)
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

// Known trusted tokens on ARC
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet",
    refSupply: "1000000000000000"
  }
};

// Chart instances
let riskPieChart = null;
let riskBarChart = null;
let riskLineChart = null;
let supplyBarChart = null;

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("analyzeBtn");
  const themeToggle = document.getElementById("themeToggle");
  const copyBtn = document.getElementById("copyAddressBtn");

  btn.addEventListener("click", handleAnalyze);
  document
    .getElementById("tokenAddress")
    .addEventListener("keyup", (e) => {
      if (e.key === "Enter") handleAnalyze();
    });

  initThemeToggle(themeToggle);
  initCopyButton(copyBtn);
});

function initThemeToggle(button) {
  const body = document.body;
  const saved = localStorage.getItem("arc-theme");
  if (saved === "light" || saved === "dark") {
    body.setAttribute("data-theme", saved);
  }
  updateThemeIcon(button);

  button.addEventListener("click", () => {
    const current = body.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", next);
    localStorage.setItem("arc-theme", next);
    updateThemeIcon(button);
  });
}

function updateThemeIcon(button) {
  const body = document.body;
  const current = body.getAttribute("data-theme") || "dark";
  button.textContent = current === "dark" ? "🌙" : "☀️";
}

function initCopyButton(copyBtn) {
  copyBtn.addEventListener("click", async () => {
    const addrShort = document.getElementById("tokenAddressShort").dataset.full;
    if (!addrShort) return;
    try {
      await navigator.clipboard.writeText(addrShort);
      copyBtn.classList.add("copied");
      copyBtn.textContent = "✔ Copied";
      setTimeout(() => {
        copyBtn.classList.remove("copied");
        copyBtn.textContent = "📋 Copy";
      }, 1200);
    } catch (e) {
      console.error("Clipboard error", e);
    }
  });
}

async function handleAnalyze() {
  const input = document.getElementById("tokenAddress");
  const address = (input.value || "").trim();

  if (!address || !address.startsWith("0x") || address.length < 10) {
    alert("Please enter a valid token contract address (0x...).");
    return;
  }

  const networkKey = document.getElementById("networkSelect").value;
  const tokenCard = document.getElementById("tokenCard");
  const riskCard = document.getElementById("riskCard");
  const chartsSection = document.getElementById("chartsSection");
  const statusMsg = document.getElementById("statusMsg");

  tokenCard.classList.add("hidden");
  riskCard.classList.add("hidden");
  chartsSection.classList.add("hidden");
  statusMsg.textContent = "Loading token data from ARC public API...";

  try {
    // network param futuro: backend pode usar para trocar de endpoint
    const resp = await fetch(
      `/api/arc-token?address=${address}&network=${networkKey}`
    );
    const data = await resp.json();

    if (!resp.ok || !data || !data.name) {
      statusMsg.textContent = "Token not found or API returned an error.";
      return;
    }

    fillTokenInfo(address, data, networkKey);

    const riskResult = applyRiskSignal(address, data); // level + score + breakdown
    updateChartsAndBreakdown(address, data, riskResult);

    tokenCard.classList.remove("hidden");
    riskCard.classList.remove("hidden");
    chartsSection.classList.remove("hidden");
    statusMsg.textContent =
      "Token loaded successfully. Always cross-check with the official explorer.";
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Failed to load token data.";
  }
}

function fillTokenInfo(address, token, networkKey) {
  const titleEl = document.getElementById("tokenTitle");
  const addrShortEl = document.getElementById("tokenAddressShort");
  const avatarEl = document.getElementById("tokenAvatar");
  const explorerLink = document.getElementById("explorerLink");

  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent =
    token.decimals ?? "unknown";
  document.getElementById("tSupplyRaw").textContent =
    token.totalSupply || "-";

  const human = formatHumanSupply(token.totalSupply, token.decimals);
  document.getElementById("tSupplyHuman").textContent = human;

  titleEl.textContent = `${token.name || "Token"} (${token.symbol || "?"})`;
  const shortAddr = shortenAddress(address);
  addrShortEl.textContent = shortAddr;
  addrShortEl.dataset.full = address;

  const network = NETWORKS[networkKey] || NETWORKS.arcTestnet;
  explorerLink.href = `${network.explorerBase}/token/${address}`;

  const label =
    (token.symbol && token.symbol[0]) ||
    (token.name && token.name[0]) ||
    "?";

  avatarEl.textContent = label.toUpperCase();
}

function shortenAddress(addr) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatHumanSupply(raw, decimals) {
  if (!raw) return "-";
  try {
    const d = Number(decimals || 0);
    const big = BigInt(raw);
    if (d <= 0) return big.toLocaleString("en-US");

    const factor = BigInt(10) ** BigInt(d);
    const intPart = big / factor;
    const fracPart = big % factor;

    let fracStr = fracPart.toString().padStart(d, "0");
    fracStr = fracStr.slice(0, 4);

    return `${intPart.toLocaleString("en-US")}.${fracStr}`;
  } catch (e) {
    return raw;
  }
}

/* ---------------------------------------
   RISK ENGINE + ICONS + GLOW + BREAKDOWN
---------------------------------------- */

function applyRiskSignal(address, token) {
  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];

  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");
  const verifiedBadge = document.getElementById("verifiedBadge");

  // reset
  riskPill.className = "risk-pill";
  verifiedBadge.classList.add("hidden");

  const breakdown = [];
  let totalScore = 0;

  /* ========= TRUSTED (LISTA) ========= */
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

    return {
      level: "safe",
      totalScore,
      breakdown
    };
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

  const famousSymbols = ["USDC", "USDT", "ETH", "BTC", "BNB", "ARB", "MATIC"];
  let impersonationScore = 0;
  if (famousSymbols.includes(symbol.toUpperCase()) && !TRUSTED_TOKENS[normalized]) {
    impersonationScore += 3;
  }

  breakdown.push({
    label: "Name / Symbol",
    score: nameSymbolScore,
    icon: nameSymbolScore ? "⚠️" : "✅",
    reason:
      nameSymbolScore > 0
        ? "Name or symbol length looks unusual for a production token."
        : "Name and symbol look reasonably structured."
  });

  breakdown.push({
    label: "Impersonation",
    score: impersonationScore,
    icon: impersonationScore ? "🚩" : "✅",
    reason:
      impersonationScore > 0
        ? `Symbol matches a well-known asset (${symbol}) but contract is not allowlisted — possible impersonation.`
        : "No obvious symbol impersonation detected."
  });

  totalScore += nameSymbolScore + impersonationScore;

  // --------- SUPPLY ----------
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
        ? "Total supply is zero — token may be defunct or misconfigured."
        : supply > 10n ** 40n
        ? "Extremely large supply — often used in low-quality or spam tokens."
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
        ? "Contract address starts with many zeros — this can be generated to look 'special' and mislead."
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

  return {
    level,
    totalScore,
    breakdown
  };
}

/* ---------------------------------------
   CHARTS + BREAKDOWN RENDER
---------------------------------------- */

function updateChartsAndBreakdown(address, token, riskResult) {
  const { level, totalScore, breakdown } = riskResult;

  // PIE
  const levelData = {
    safe: level === "safe" ? 1 : 0,
    caution: level === "caution" ? 1 : 0,
    warning: level === "warning" ? 1 : 0,
    danger: level === "danger" ? 1 : 0
  };

  const ctxPie = document.getElementById("riskPieChart");
  if (riskPieChart) riskPieChart.destroy();
  riskPieChart = new Chart(ctxPie, {
    type: "pie",
    data: {
      labels: ["Safe", "Caution", "Risky", "High risk"],
      datasets: [
        {
          data: [
            levelData.safe,
            levelData.caution,
            levelData.warning,
            levelData.danger
          ],
          backgroundColor: [
            "rgba(34,197,94,0.8)",
            "rgba(252,211,77,0.9)",
            "rgba(249,115,22,0.9)",
            "rgba(248,113,113,0.9)"
          ]
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#e5e7eb", boxWidth: 14, font: { size: 11 } }
        }
      }
    }
  });

  // BAR: breakdown
  const labels = breakdown.map((b) => b.label);
  const scores = breakdown.map((b) => b.score);

  const ctxBar = document.getElementById("riskBarChart");
  if (riskBarChart) riskBarChart.destroy();
  riskBarChart = new Chart(ctxBar, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Score",
          data: scores,
          backgroundColor: "rgba(59,130,246,0.8)"
        }
      ]
    },
    options: {
      scales: {
        x: {
          ticks: { color: "#e5e7eb", font: { size: 10 } }
        },
        y: {
          ticks: { color: "#e5e7eb", stepSize: 1 },
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          labels: { color: "#e5e7eb" }
        }
      }
    }
  });

  // LINE: cumulative
  let cumulative = 0;
  const cumData = breakdown.map((b) => {
    cumulative += b.score;
    return cumulative;
  });

  const ctxLine = document.getElementById("riskLineChart");
  if (riskLineChart) riskLineChart.destroy();
  riskLineChart = new Chart(ctxLine, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Cumulative risk score",
          data: cumData,
          borderColor: "rgba(249,115,22,0.9)",
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 3
        }
      ]
    },
    options: {
      scales: {
        x: { ticks: { color: "#e5e7eb", font: { size: 10 } } },
        y: {
          ticks: { color: "#e5e7eb", stepSize: 1 },
          beginAtZero: true
        }
      },
      plugins: {
        legend: { labels: { color: "#e5e7eb" } }
      }
    }
  });

  // SUPPLY comparison
  const ctxSupply = document.getElementById("supplyBarChart");
  if (supplyBarChart) supplyBarChart.destroy();

  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];
  let thisSupply = 0;
  let usdcSupply = 0;

  try {
    thisSupply = Number(token.totalSupply || "0");
  } catch {}

  if (trusted && trusted.refSupply) {
    try {
      usdcSupply = Number(trusted.refSupply);
    } catch {}
  } else {
    try {
      usdcSupply = Number(
        TRUSTED_TOKENS["0x3600000000000000000000000000000000000000"].refSupply
      );
    } catch {}
  }

  const norm = (n) => (n === 0 ? 0 : Math.log10(n + 1));

  supplyBarChart = new Chart(ctxSupply, {
    type: "bar",
    data: {
      labels: ["This token", "USDC (ref)"],
      datasets: [
        {
          data: [norm(thisSupply), norm(usdcSupply)],
          backgroundColor: ["rgba(96,165,250,0.9)", "rgba(16,185,129,0.9)"]
        }
      ]
    },
    options: {
      scales: {
        x: { ticks: { color: "#e5e7eb" } },
        y: {
          ticks: { color: "#e5e7eb" },
          beginAtZero: true
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  renderRiskBreakdown(level, totalScore, breakdown);
}

function renderRiskBreakdown(level, totalScore, breakdown) {
  const container = document.getElementById("riskBreakdown");

  let levelLabel =
    level === "safe"
      ? "Likely Safe"
      : level === "caution"
      ? "Caution"
      : level === "warning"
      ? "Risky"
      : "High Risk";

  const html = [
    `<h3>Why this rating? (${levelLabel}, score ${totalScore})</h3>`,
    "<ul>",
    ...breakdown.map(
      (b) =>
        `<li>${b.icon} <strong>${b.label}:</strong> ${b.reason} ${
          b.score ? `(score +${b.score})` : ""
        }</li>`
    ),
    "</ul>"
  ].join("");

  container.innerHTML = html;
}
