/**
 * Heuristic risk signal (versão mais completa)
 * - trusted se estiver no allowlist
 * - senão, soma score por vários fatores:
 *   decimals, nome/symbol, impersonation, supply, padrão do endereço, etc.
 * - também gera o texto “Why this rating?” com explicações por item
 */
function applyRiskSignal(address, token) {
  const normalized = (address || "").toLowerCase();
  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");
  const verifiedBadge = document.getElementById("verifiedBadge");
  const riskBreakdownEl = document.getElementById("riskBreakdown");

  // reset visual
  riskPill.className = "risk-pill risk-unknown";
  riskPill.classList.remove("glow-danger");
  verifiedBadge.classList.add("hidden");

  // -------- 1) trusted list (USDC etc.) --------
  const trusted = TRUSTED_TOKENS[normalized];
  const breakdownItems = [];
  let totalScore = 0;

  const addItem = (icon, label, text, scoreDelta) => {
    // scoreDelta pode ser 0 (neutro), 1, 2 etc.
    if (typeof scoreDelta === "number") {
      totalScore += scoreDelta;
    }
    breakdownItems.push({
      icon,
      label,
      text,
      scoreDelta: scoreDelta || 0
    });
  };

  if (trusted) {
    // Token está na lista de confiança (ex: USDC oficial)
    riskPill.textContent = "Trusted";
    riskPill.classList.add("risk-safe");
    verifiedBadge.classList.remove("hidden");

    riskTitle.textContent = `${token.symbol || "Token"} is marked as trusted.`;
    riskDesc.textContent =
      (trusted.note || "Community-trusted token.") +
      " · Still, always verify URLs, contracts and official documentation.";

    addItem(
      "✅",
      "Trusted list",
      "This contract is in the ARC Token Inspector trusted allowlist (manually curated).",
      0
    );
    addItem(
      "ℹ️",
      "Heuristics still apply",
      "Even trusted tokens should still be checked with the official explorer and docs.",
      0
    );

    if (riskBreakdownEl) {
      riskBreakdownEl.innerHTML =
        `<h3>Why this rating? (Trusted, score 0)</h3>` +
        `<ul>${breakdownItems
          .map(
            (it) =>
              `<li>${it.icon} <strong>${it.label}:</strong> ${it.text}</li>`
          )
          .join("")}</ul>`;
    }

    return;
  }

  // -------- 2) heurísticas detalhadas --------

  const decimals = Number(token.decimals ?? 0);
  const rawSupplyStr = token.totalSupply || "0";
  let rawSupply = 0n;
  try {
    rawSupply = BigInt(rawSupplyStr);
  } catch {
    rawSupply = 0n;
  }

  const name = (token.name || "").trim();
  const symbol = (token.symbol || "").trim();

  // 2.1 Decimals
  (() => {
    if (!Number.isFinite(decimals)) {
      addItem(
        "⚠️",
        "Decimals",
        "Could not read decimals — treat this token with caution.",
        1
      );
      return;
    }

    if (decimals === 0) {
      addItem(
        "⚠️",
        "Decimals",
        "Token has 0 decimals — unusual for most mainstream ERC-20 tokens.",
        2
      );
    } else if (decimals < 4 || decimals > 24) {
      addItem(
        "⚠️",
        "Decimals",
        `Token has ${decimals} decimals — outside the usual range (4–24) used by most tokens.`,
        1
      );
    } else {
      addItem(
        "✅",
        "Decimals",
        `Decimals (${decimals}) are within a common range for ERC-20 tokens.`,
        0
      );
    }
  })();

  // 2.2 Name / Symbol estrutura básica
  (() => {
    let localScore = 0;
    let msgs = [];

    if (!name || name.length < 3) {
      localScore += 1;
      msgs.push("very short or missing name");
    }
    if (!symbol || symbol.length < 2 || symbol.length > 12) {
      localScore += 1;
      msgs.push("unusual symbol length");
    }
    if (symbol && /[^A-Z0-9]/i.test(symbol)) {
      localScore += 1;
      msgs.push("symbol has non-alphanumeric characters");
    }

    if (localScore === 0) {
      addItem(
        "✅",
        "Name / Symbol",
        "Name and symbol look reasonably structured.",
        0
      );
    } else {
      addItem(
        "⚠️",
        "Name / Symbol",
        `Name/symbol look a bit irregular (${msgs.join(", ")}).`,
        localScore
      );
    }
  })();

  // 2.3 Impersonation de tokens famosos
  (() => {
    const FAMOUS = [
      { symbol: "USDC", ref: "0x3600000000000000000000000000000000000000" },
      { symbol: "USDT" },
      { symbol: "DAI" },
      { symbol: "WETH" },
      { symbol: "WBTC" }
    ];

    const symUpper = symbol.toUpperCase();
    const hit = FAMOUS.find((t) => t.symbol === symUpper);

    if (!hit) {
      addItem(
        "✅",
        "Impersonation",
        "No obvious symbol impersonation detected.",
        0
      );
      return;
    }

    if (hit.ref && normalized !== hit.ref.toLowerCase()) {
      // mesm símbolo, mas endereço diferente do oficial que a gente conhece
      addItem(
        "⚠️",
        "Impersonation",
        `Symbol matches a well-known token (${hit.symbol}), but the contract address is different from the usual reference — double-check in the official explorer.`,
        2
      );
    } else if (!hit.ref) {
      addItem(
        "⚠️",
        "Impersonation",
        `Symbol (${hit.symbol}) is commonly used by popular tokens. Make sure this is the intended contract and not a clone.`,
        1
      );
    } else {
      addItem(
        "✅",
        "Impersonation",
        "Symbol matches a known token and this address is the expected one for this network.",
        0
      );
    }
  })();

  // 2.4 Total supply (quebrado, zero, gigantesco etc.)
  (() => {
    if (rawSupply === 0n) {
      addItem(
        "⚠️",
        "Total supply",
        "Total supply is zero — token may be defunct, misconfigured or still not minted.",
        2
      );
      return;
    }

    // normalizar supply em unidades humanas aproximadas
    let humanLog10 = 0;
    try {
      const s = rawSupply.toString();
      humanLog10 = s.length - (decimals || 0);
    } catch {
      humanLog10 = 0;
    }

    if (humanLog10 < 1) {
      addItem(
        "⚠️",
        "Total supply",
        "Total supply is extremely small compared to typical ERC-20 tokens.",
        1
      );
    } else if (humanLog10 > 40) {
      addItem(
        "⚠️",
        "Total supply",
        "Total supply is extremely large — beware of unlimited mint or hyper-inflation patterns.",
        2
      );
    } else {
      addItem(
        "✅",
        "Total supply",
        "Total supply is within a broad but plausible range.",
        0
      );
    }
  })();

  // 2.5 Padrão do endereço
  (() => {
    let score = 0;
    let notes = [];

    if (normalized.startsWith("0x000000")) {
      score += 2;
      notes.push("starts with many zeros");
    }
    if (/0{8,}$/.test(normalized)) {
      score += 1;
      notes.push("ends with a long zero sequence");
    }

    if (score === 0) {
      addItem(
        "✅",
        "Address pattern",
        "Contract address pattern is not inherently suspicious.",
        0
      );
    } else {
      addItem(
        "⚠️",
        "Address pattern",
        `Contract address pattern looks a bit artificial (${notes.join(
          ", "
        )}). This alone does not prove a scam, but combined with other factors it can increase risk.`,
        score
      );
    }
  })();

  // 2.6 Verificação do contrato (ABI/source)
  (() => {
    // No testnet atual a API que você usa não retorna status de verificação.
    // Então não atribuímos score, só explicação.
    addItem(
      "ℹ️",
      "Contract verification",
      "Verification status (source/ABI) is not available via this testnet endpoint. On mainnet, an unverified contract would usually be a strong red flag.",
      0
    );
  })();

  // 2.7 Honeypot checks
  (() => {
    addItem(
      "ℹ️",
      "Honeypot checks",
      "Static honeypot analysis (buy/sell simulation, blacklist checks) is not enabled on this testnet version. Before using a token on mainnet, always run a dedicated honeypot scanner.",
      0
    );
  })();

  // 2.8 Creation age (recente / muito novo)
  (() => {
    addItem(
      "ℹ️",
      "Creation age",
      "Creation block / age data is not exposed by this testnet API. On mainnet, extremely new contracts (few blocks old) are usually higher risk.",
      0
    );
  })();

  // -------- 3) Mapeia score total para nível --------
  let level = "safe";
  if (totalScore >= 7) level = "high";
  else if (totalScore >= 4) level = "risky";
  else if (totalScore >= 2) level = "caution";

  let ratingLabel = "";
  let pillText = "";

  if (level === "safe") {
    pillText = "Likely Safe";
    ratingLabel = "Safe";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "No obvious red flags detected.";
    riskDesc.textContent =
      "Basic heuristics did not detect major issues. This does NOT guarantee safety — always do your own research.";
  } else if (level === "caution") {
    pillText = "Caution";
    ratingLabel = "Caution";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Some mildly suspicious characteristics.";
    riskDesc.textContent =
      "A few parameters (decimals, supply or naming) look a bit unusual. Review the contract and project carefully before interacting.";
  } else if (level === "risky") {
    pillText = "Risky";
    ratingLabel = "Risky";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Several red flags found.";
    riskDesc.textContent =
      "Multiple heuristics (decimals, supply or address pattern) look suspicious. Treat this token as high risk.";
  } else {
    pillText = "High Risk";
    ratingLabel = "High risk";
    riskPill.classList.add("risk-danger", "glow-danger");
    riskTitle.textContent = "Strong red flags — avoid interacting.";
    riskDesc.textContent =
      "On-chain metadata strongly suggests this may be a scam or broken token. Do NOT use this contract unless you know exactly what you are doing.";
  }

  riskPill.textContent = pillText;

  // -------- 4) Renderiza “Why this rating?” --------
  if (riskBreakdownEl) {
    riskBreakdownEl.innerHTML =
      `<h3>Why this rating? (${ratingLabel}, score ${totalScore})</h3>` +
      `<ul>${breakdownItems
        .map((it) => {
          const scoreInfo =
            it.scoreDelta && it.scoreDelta > 0
              ? ` (score +${it.scoreDelta})`
              : "";
          return `<li>${it.icon} <strong>${it.label}:</strong> ${
            it.text
          }${scoreInfo}</li>`;
        })
        .join("")}</ul>`;
  }
}
