// tokens.js
// -----------------------------------------------------------------------------
// Heurística de risco + preenchimento do layout EXISTENTE
// Não altera nada de HTML/CSS, só a lógica e os textos.
// -----------------------------------------------------------------------------

// Lista de tokens confiáveis (whitelist)
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet",
  },
};

// Utilitário: encurtar endereço
function shortenAddress(addr) {
  if (!addr || addr.length < 12) return addr || "-";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// Utilitário: formatar supply humano
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
    fracStr = fracStr.slice(0, 4); // até 4 casas

    return `${intPart.toLocaleString("en-US")}.${fracStr}`;
  } catch (e) {
    return raw;
  }
}

// -----------------------------------------------------------------------------
// Carregamento inicial
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("analyzeBtn");
  if (btn) {
    btn.addEventListener("click", handleAnalyze);
  }

  const input = document.getElementById("tokenAddress");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleAnalyze();
      }
    });
  }

  const networkSelect = document.getElementById("networkSelect");
  if (networkSelect) {
    networkSelect.addEventListener("change", () => {
      // Bloqueia mainnet (soon)
      if (networkSelect.value !== "testnet") {
        alert("ARC Mainnet (soon) ainda não está disponível neste dApp.");
        networkSelect.value = "testnet";
      }
    });
  }
});

// -----------------------------------------------------------------------------
// Handler principal
// -----------------------------------------------------------------------------
async function handleAnalyze() {
  const input = document.getElementById("tokenAddress");
  const address = (input?.value || "").trim();

  if (!address || !address.startsWith("0x") || address.length < 10) {
    alert("Please enter a valid ARC-20 token address (0x...).");
    return;
  }

  const networkSelect = document.getElementById("networkSelect");
  const network = networkSelect ? networkSelect.value : "testnet";

  const statusMsg = document.getElementById("statusMsg");
  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");

  if (statusMsg) statusMsg.textContent = "Loading token metadata from ARC explorer…";
  if (riskCard) riskCard.classList.add("hidden");
  if (tokenCard) tokenCard.classList.add("hidden");

  try {
    // Endpoint interno já configurado no backend (/api/arc-token)
    const resp = await fetch(`/api/arc-token?address=${address}&network=${network}`);
    const data = await resp.json();

    if (!resp.ok || !data || !data.name) {
      if (statusMsg) statusMsg.textContent = "Error loading token. Explorer did not return basic metadata.";
      return;
    }

    // Preenche card do token
    fillTokenInfo(address, data);

    // Calcula heurística de risco + monta lista
    applyRiskHeuristics(address, data);

    if (riskCard) riskCard.classList.remove("hidden");
    if (tokenCard) tokenCard.classList.remove("hidden");
    if (statusMsg) {
      statusMsg.textContent =
        "Token loaded successfully. Always cross-check with the official explorer.";
    }
  } catch (err) {
    console.error(err);
    if (statusMsg) statusMsg.textContent = "Error loading token.";
  }
}

// -----------------------------------------------------------------------------
// Preencher card do token (lado direito)
// -----------------------------------------------------------------------------
function fillTokenInfo(address, token) {
  const titleEl = document.getElementById("tokenTitle");
  const addrShortEl = document.getElementById("tokenAddressShort");
  const avatarEl = document.getElementById("tokenAvatar");

  const name = token.name || "-";
  const symbol = token.symbol || "-";
  const decimals = token.decimals ?? "unknown";
  const supplyRaw = token.totalSupply || "-";
  const supplyHuman = formatHumanSupply(token.totalSupply, token.decimals);

  const tName = document.getElementById("tName");
  const tSymbol = document.getElementById("tSymbol");
  const tDecimals = document.getElementById("tDecimals");
  const tSupplyRaw = document.getElementById("tSupplyRaw");
  const tSupplyHuman = document.getElementById("tSupplyHuman");

  if (tName) tName.textContent = name;
  if (tSymbol) tSymbol.textContent = symbol;
  if (tDecimals) tDecimals.textContent = decimals;
  if (tSupplyRaw) tSupplyRaw.textContent = supplyRaw;
  if (tSupplyHuman) tSupplyHuman.textContent = supplyHuman;

  if (titleEl) titleEl.textContent = `${name} (${symbol})`;
  if (addrShortEl) addrShortEl.textContent = shortenAddress(address);

  const label =
    (symbol && symbol[0]) || (name && name[0]) || "?";
  if (avatarEl) avatarEl.textContent = label.toUpperCase();
}

// -----------------------------------------------------------------------------
// Heurística de risco + breakdown
// -----------------------------------------------------------------------------
function applyRiskHeuristics(address, token) {
  const riskPill = document.getElementById("riskPill");
  const riskSummary = document.getElementById("riskSummary");
  const riskBreakdownTitle = document.getElementById("riskBreakdownTitle");
  const riskBreakdownList = document.getElementById("riskBreakdownList");
  const verifiedBadge = document.getElementById("verifiedBadge");

  if (riskBreakdownList) riskBreakdownList.innerHTML = "";
  if (verifiedBadge) verifiedBadge.classList.add("hidden");

  const addrLower = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[addrLower];

  // -------------------------
  // Fatores & pontuação
  // -------------------------
  let score = 0;
  const factors = [];

  const name = token.name || "";
  const symbol = token.symbol || "";
  const decimals = Number(token.decimals ?? 0);
  const supplyStr = token.totalSupply || "0";

  let supply = 0n;
  try {
    supply = BigInt(supplyStr);
  } catch (_) {
    // se não der pra fazer BigInt, deixa 0 (e trata como estranho)
  }

  // Helper para adicionar item
  function addFactor(icon, label, text, delta) {
    factors.push({ icon, label, text, delta });
    if (delta > 0) score += delta;
  }

  // 1) Decimals
  if (decimals === 0) {
    addFactor(
      "⚠️",
      "Decimals:",
      "Token has 0 decimals — unusual for most mainstream ERC-20 tokens. (score +2)",
      2
    );
  } else if (decimals > 24) {
    addFactor(
      "⚠️",
      "Decimals:",
      `Token uses very high decimals (${decimals}), which can make balances confusing. (score +2)`,
      2
    );
  } else if (decimals > 18) {
    addFactor(
      "⚠️",
      "Decimals:",
      `Decimals slightly above typical ERC-20 patterns (${decimals}). (score +1)`,
      1
    );
  } else {
    addFactor(
      "✅",
      "Decimals:",
      `Decimals look reasonable for an ERC-20 style token (${decimals}). (score +0)`,
      0
    );
  }

  // 2) Name / Symbol básicos
  if (!name || !symbol) {
    addFactor(
      "⚠️",
      "Name / Symbol:",
      "Name or symbol is missing — poorly configured metadata. (score +2)",
      2
    );
  } else if (symbol.length < 2 || symbol.length > 11) {
    addFactor(
      "⚠️",
      "Name / Symbol:",
      `Symbol length (${symbol.length}) is unusual. Very short or very long symbols can be low-effort spam. (score +1)`,
      1
    );
  } else {
    addFactor(
      "✅",
      "Name / Symbol:",
      "Name and symbol look reasonably structured. (score +0)",
      0
    );
  }

  // 3) Impersonation / keywords / spam de caracteres
  const blueChips = ["USDC", "USDT", "USDC.e", "ETH", "WETH", "WBTC", "BTC", "DAI"];
  const hypeWords = ["MOON", "1000X", "PUMP", "RUG", "INU", "ELON", "PEPE"];

  const symUpper = symbol.toUpperCase();
  const nameUpper = name.toUpperCase();

  if (blueChips.includes(symUpper) && !trusted) {
    addFactor(
      "⚠️",
      "Impersonation:",
      "Symbol matches a well-known token but address is not in the trusted list. Could be impersonation. (score +2)",
      2
    );
  } else if (hypeWords.some((w) => symUpper.includes(w) || nameUpper.includes(w))) {
    addFactor(
      "⚠️",
      "Impersonation:",
      "Name/symbol contain very common hype words (moon, 1000x, inu, pepe, elon, etc.). Treat with caution. (score +1)",
      1
    );
  } else {
    addFactor(
      "✅",
      "Impersonation:",
      "No obvious symbol impersonation or hype-word pattern detected. (score +0)",
      0
    );
  }

  // 4) Pattern de caracteres estranhos / repetição
  const weirdCharRegex = /[^A-Za-z0-9\s]/;
  const repeatRegex = /(.)\1{3,}/; // 4+ vezes seguidas

  const hasWeird =
    weirdCharRegex.test(symbol) || weirdCharRegex.test(name);
  const hasRepeats =
    repeatRegex.test(symbol) || repeatRegex.test(name);

  if (hasWeird || hasRepeats) {
    addFactor(
      "⚠️",
      "Name / Symbol quality:",
      "Name or symbol use unusual or repeated characters (emoji, long runs of the same char). Often seen in spam tokens. (score +1)",
      1
    );
  } else {
    addFactor(
      "✅",
      "Name / Symbol quality:",
      "No obvious spammy character patterns in name/symbol. (score +0)",
      0
    );
  }

  // 5) Total supply / “quebrado”
  if (supply === 0n) {
    addFactor(
      "⚠️",
      "Total supply:",
      "Total supply is zero — token may be defunct or misconfigured. (score +2)",
      2
    );
  } else {
    const digitCount = supplyStr.replace(/^0+/, "").length;
    if (digitCount > 40) {
      addFactor(
        "⚠️",
        "Total supply:",
        "Total supply is extremely large compared to typical patterns — purely heuristic, but treat with caution. (score +1)",
        1
      );
    } else if (decimals > 0 && digitCount <= decimals) {
      addFactor(
        "⚠️",
        "Total supply:",
        "Total supply is very small relative to the number of decimals — configuration looks odd. (score +1)",
        1
      );
    } else {
      addFactor(
        "✅",
        "Total supply:",
        "Total supply does not look obviously broken based on raw metadata alone. (score +0)",
        0
      );
    }
  }

  // 6) Address pattern
  if (
    addrLower.startsWith("0x000000") ||
    addrLower.startsWith("0xfffffff") ||
    addrLower.startsWith("0x1234") ||
    addrLower.includes("bad") // só uma heurística boba
  ) {
    addFactor(
      "⚠️",
      "Address pattern:",
      "Contract address pattern is somewhat suspicious (all zeros/ffs/obvious pattern). (score +1)",
      1
    );
  } else {
    addFactor(
      "✅",
      "Address pattern:",
      "Contract address pattern is not inherently suspicious. (score +0)",
      0
    );
  }

  // 7) Contract verification (informativo)
  addFactor(
    "ℹ️",
    "Contract verification:",
    "Verification status is not exposed by this testnet endpoint. On mainnet, a non-verified contract would be a strong red flag. (score +0)",
    0
  );

  // 8) Honeypot checks (informativo)
  addFactor(
    "ℹ️",
    "Honeypot checks:",
    "Static honeypot analysis (buy/sell simulation, blacklist checks) is not enabled on this testnet version. (score +0)",
    0
  );

  // 9) Creation age (informativo)
  addFactor(
    "ℹ️",
    "Creation age:",
    "Creation block / age data is not exposed by this API on testnet. On mainnet, extremely new contracts are usually higher risk. (score +0)",
    0
  );

  // -------------------------
  // Se token é trusted, força nível “Trusted”
  // -------------------------
  let level = "unknown";
  if (trusted) {
    level = "trusted";
    score = 0; // confiável, mas ainda mostramos breakdown
  } else {
    // Mapear score -> nível
    if (score <= 1) level = "safe";
    else if (score <= 3) level = "caution";
    else if (score <= 6) level = "risky";
    else level = "high";
  }

  const levelLabel =
    level === "trusted"
      ? "Trusted"
      : level === "safe"
      ? "Likely safe"
      : level === "caution"
      ? "Caution"
      : level === "risky"
      ? "Risky"
      : level === "high"
      ? "High risk"
      : "Unknown";

  // -------------------------
  // Aplica classes no pill
  // -------------------------
  if (riskPill) {
    riskPill.className = "risk-pill risk-unknown";
    riskPill.textContent = levelLabel.toUpperCase();

    if (level === "trusted" || level === "safe") {
      riskPill.classList.add("risk-safe");
    } else if (level === "caution" || level === "risky") {
      riskPill.classList.add("risk-warning");
    } else if (level === "high") {
      riskPill.classList.add("risk-danger", "glow-danger");
    }
  }

  if (trusted && verifiedBadge) {
    verifiedBadge.classList.remove("hidden");
  }

  if (riskSummary) {
    if (trusted) {
      riskSummary.textContent =
        `${trusted.label} is marked as trusted. Still, always verify URLs, contracts and official documentation.`;
    } else if (level === "safe") {
      riskSummary.textContent =
        "Basic heuristics did not detect major red flags. This does NOT guarantee safety — always do your own research.";
    } else if (level === "caution") {
      riskSummary.textContent =
        "Some mildly suspicious characteristics were found. Interact only if you fully understand the project.";
    } else if (level === "risky") {
      riskSummary.textContent =
        "Several heuristic red flags were found. Treat this token as high risk.";
    } else if (level === "high") {
      riskSummary.textContent =
        "Strong red flags — interacting with this contract may be very risky.";
    } else {
      riskSummary.textContent =
        "No token analyzed yet — paste a contract address above to see a heuristic signal.";
    }
  }

  if (riskBreakdownTitle) {
    const labelForTitle = trusted ? "Trusted" : levelLabel;
    riskBreakdownTitle.textContent = `Why this rating? (${labelForTitle}, score ${score})`;
  }

  // Monta a lista <li>…</li>
  if (riskBreakdownList) {
    factors.forEach((f) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="mono">${f.icon}</span> <strong>${f.label}</strong> ${f.text}`;
      riskBreakdownList.appendChild(li);
    });

    // Rodapé fixo (mesma mensagem que você já tinha)
    const liFooter = document.createElement("li");
    liFooter.innerHTML =
      "Heuristic only — always double-check the contract yourself. No private APIs, only public on-chain data & basic rules.";
    riskBreakdownList.appendChild(liFooter);
  }
}
