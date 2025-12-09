// Simple ARC Token Inspector logic
// All checks here are heuristic only – never trust a single signal.

/* -----------------------------
   1. Known trusted tokens list
   ----------------------------- */

const TRUSTED_TOKENS = {
  // Official USDC on ARC Testnet
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

/* -----------------------------
   2. Bootstrapping
   ----------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("analyzeBtn");
  btn.addEventListener("click", handleAnalyze);

  const input = document.getElementById("tokenAddress");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleAnalyze();
    }
  });
});

/* -----------------------------
   3. Main analyze handler
   ----------------------------- */

async function handleAnalyze() {
  const input = document.getElementById("tokenAddress");
  const address = (input.value || "").trim();

  if (!address || !address.startsWith("0x") || address.length < 10) {
    alert("Please paste a valid ARC-20 contract address (0x...).");
    return;
  }

  const tokenCard = document.getElementById("tokenCard");
  const riskCard = document.getElementById("riskCard");
  const statusMsg = document.getElementById("statusMsg");

  statusMsg.textContent = "Loading token data from ARC public API...";
  tokenCard.classList.remove("hidden");
  riskCard.classList.remove("hidden");

  try {
    // For now I only support testnet (mainnet endpoint will come later)
    const resp = await fetch(`/api/arc-token?address=${address}`);
    const data = await resp.json();

    if (!resp.ok || !data || !data.name) {
      console.error("API error:", data);
      statusMsg.textContent = "Error loading token. API did not return metadata.";
      // I still show the risk card in case user wants to see heuristics text
      applyRiskSignal(address, null);
      return;
    }

    // Fill token info box
    fillTokenInfo(address, data);

    // Run risk heuristics
    applyRiskSignal(address, data);

    statusMsg.textContent =
      "Token loaded successfully. Always cross-check with the official explorer.";
  } catch (err) {
    console.error("Fetch error:", err);
    statusMsg.textContent = "Error loading token.";
  }
}

/* -----------------------------
   4. Token info rendering
   ----------------------------- */

function fillTokenInfo(address, token) {
  const titleEl = document.getElementById("tokenTitle");
  const addrShortEl = document.getElementById("tokenAddressShort");
  const avatarEl = document.getElementById("tokenAvatar");

  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent =
    token.decimals ?? "unknown";
  document.getElementById("tSupplyRaw").textContent =
    token.totalSupply || "-";

  const human = formatHumanSupply(token.totalSupply, token.decimals);
  document.getElementById("tSupplyHuman").textContent = human;

  titleEl.textContent = `${token.name || "Token"} (${token.symbol || "?"})`;
  addrShortEl.textContent = shortenAddress(address);

  // avatar = first letter of symbol or name
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
    // UI only needs a few decimals
    fracStr = fracStr.slice(0, 4);

    return `${intPart.toLocaleString("en-US")}.${fracStr}`;
  } catch (e) {
    return raw;
  }
}

/* -----------------------------
   5. Heuristic risk engine
   ----------------------------- */

function applyRiskSignal(address, token) {
  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];

  const riskPill = document.getElementById("riskPill");
  const riskDescription = document.getElementById("riskDescription");
  const breakdownList = document.getElementById("riskBreakdownList");

  // Reset pill style
  riskPill.className = "risk-pill risk-unknown";
  breakdownList.innerHTML = "";

  // If I don't have token metadata, I just show a generic message
  if (!token) {
    riskPill.textContent = "RISKY";
    riskDescription.textContent =
      "Token metadata could not be loaded. Always treat unknown contracts as high risk.";
    addBullet(breakdownList, "⚠️", "No metadata", "API did not return any data for this address.");
    addBullet(
      breakdownList,
      "⚠️",
      "Always verify",
      "Double-check the contract on the official explorer before interacting."
    );
    return;
  }

  // If token is in my allowlist, I treat it as trusted but still show warnings.
  if (trusted) {
    riskPill.textContent = "TRUSTED";
    riskPill.classList.add("risk-safe");

    riskDescription.textContent = `${token.symbol || "Token"} is marked as trusted in my local allowlist.`;

    addBullet(
      breakdownList,
      "✅",
      "Allowlisted token",
      trusted.note +
        ". Even so, always confirm contract address from official sources."
    );

    // I still run the heuristics, but they won't override the pill label
    const extra = runHeuristics(address, token);
    extra.forEach((item) => renderBullet(breakdownList, item));
    return;
  }

  // Run all heuristic checks
  const results = runHeuristics(address, token);

  // Total score
  const totalScore = results.reduce((acc, r) => acc + (r.scoreDelta || 0), 0);

  // Convert score -> level
  let level = "safe";
  if (totalScore >= 7) level = "high";
  else if (totalScore >= 4) level = "risky";
  else if (totalScore >= 2) level = "caution";

  // Apply pill style + summary text
  if (level === "safe") {
    riskPill.textContent = "LIKELY SAFE";
    riskPill.classList.add("risk-safe");
    riskDescription.textContent =
      "No strong red flags detected based on basic on-chain metadata. This still does NOT guarantee safety.";
  } else if (level === "caution") {
    riskPill.textContent = "CAUTION";
    riskPill.classList.add("risk-warning");
    riskDescription.textContent =
      "Some parameters look a bit unusual. Make sure you fully understand this project before interacting.";
  } else if (level === "risky") {
    riskPill.textContent = "RISKY";
    riskPill.classList.add("risk-warning");
    riskDescription.textContent =
      "Several heuristic red flags were found. Interact only if you fully understand the risks.";
  } else {
    // high risk
    riskPill.textContent = "HIGH RISK";
    riskPill.classList.add("risk-danger", "glow-danger");
    riskDescription.textContent =
      "Strong red flags detected. The token might be broken or designed to be unsafe. Avoid interacting.";
  }

  // Render bullets
  results.forEach((item) => renderBullet(breakdownList, item));
}

/**
 * I keep this function pure: it only calculates the heuristic checks
 * and returns a list of { icon, label, text, scoreDelta } objects.
 */
function runHeuristics(address, token) {
  const results = [];
  let score = 0;

  const decimals = Number(token.decimals || 0);
  const supplyStr = token.totalSupply || "0";
  let supply = 0n;
  try {
    supply = BigInt(supplyStr);
  } catch {
    // ignore parsing error; I just treat it as 0
  }

  const symbol = (token.symbol || "").toUpperCase();
  const name = token.name || "";
  const normalized = address.toLowerCase();
  const holders = typeof token.holders === "number" ? token.holders : null;

  /* --- 5.1 Decimals --- */
  if (decimals === 0) {
    score += 2;
    results.push({
      icon: "⚠️",
      label: "Decimals",
      text: "Token has 0 decimals — unusual for most mainstream ERC-20 tokens. (score +2)",
      scoreDelta: 2
    });
  } else if (decimals > 18) {
    score += 2;
    results.push({
      icon: "⚠️",
      label: "Decimals",
      text: `Token uses ${decimals} decimals — higher than typical 18-decimals tokens. (score +2)`,
      scoreDelta: 2
    });
  } else if (decimals === 6 || decimals === 18) {
    results.push({
      icon: "✅",
      label: "Decimals",
      text: `Decimals are ${decimals}, which looks normal for many stablecoins / ERC-20 tokens. (score +0)`,
      scoreDelta: 0
    });
  } else {
    results.push({
      icon: "⚠️",
      label: "Decimals",
      text: `Decimals are ${decimals}. Not necessarily bad, but a bit unusual compared to typical 6/18. (score +1)`,
      scoreDelta: 1
    });
    score += 1;
  }

  /* --- 5.2 Name / Symbol quality --- */
  const goodName =
    name.length >= 3 && name.length <= 40 && !/[^a-z0-9\s\-\.\_]/i.test(name);
  const goodSymbol =
    symbol.length >= 2 && symbol.length <= 8 && /^[A-Z0-9]+$/.test(symbol);

  if (goodName && goodSymbol) {
    results.push({
      icon: "✅",
      label: "Name / Symbol",
      text: "Name and symbol look reasonably structured. (score +0)",
      scoreDelta: 0
    });
  } else {
    score += 1;
    results.push({
      icon: "⚠️",
      label: "Name / Symbol",
      text: "Name or symbol look a bit odd (too short, too long or with strange characters). (score +1)",
      scoreDelta: 1
    });
  }

  /* --- 5.3 Impersonation check --- */
  const famousSymbols = ["USDC", "USDT", "ETH", "BTC", "WBTC", "DAI"];
  if (famousSymbols.includes(symbol) && !TRUSTED_TOKENS[normalized]) {
    score += 2;
    results.push({
      icon: "⚠️",
      label: "Impersonation",
      text: "Symbol matches a well-known token but this contract is not in my trusted list. Could be impersonation. (score +2)",
      scoreDelta: 2
    });
  } else {
    results.push({
      icon: "✅",
      label: "Impersonation",
      text: "No obvious symbol impersonation detected. (score +0)",
      scoreDelta: 0
    });
  }

  /* --- 5.4 Total supply sanity --- */
  if (supply === 0n) {
    score += 2;
    results.push({
      icon: "⚠️",
      label: "Total supply",
      text: "Total supply is zero — token may be defunct or misconfigured. (score +2)",
      scoreDelta: 2
    });
  } else if (supply > 10n ** 40n) {
    score += 2;
    results.push({
      icon: "⚠️",
      label: "Total supply",
      text: "Total supply is extremely large. This can be used in weird tokenomics. (score +2)",
      scoreDelta: 2
    });
  } else {
    results.push({
      icon: "✅",
      label: "Total supply",
      text: "Total supply is within a normal range for ERC-20 style tokens. (score +0)",
      scoreDelta: 0
    });
  }

  /* --- 5.5 Address pattern --- */
  if (normalized.startsWith("0x000000")) {
    score += 2;
    results.push({
      icon: "⚠️",
      label: "Address pattern",
      text: "Contract address starts with many zeros – can be fine, but often used for vanity / burn addresses. (score +2)",
      scoreDelta: 2
    });
  } else {
    results.push({
      icon: "ℹ️",
      label: "Address pattern",
      text: "Contract address pattern is not inherently suspicious. (score +0)",
      scoreDelta: 0
    });
  }

  /* --- 5.6 Holders count (if available) --- */
  if (holders === null) {
    results.push({
      icon: "ℹ️",
      label: "Holders",
      text: "Holders count is not exposed by this endpoint. On mainnet, a very low holder count is usually higher risk.",
      scoreDelta: 0
    });
  } else if (holders < 10) {
    score += 2;
    results.push({
      icon: "⚠️",
      label: "Holders",
      text: `Only ${holders} holders detected — very low liquidity / adoption. (score +2)`,
      scoreDelta: 2
    });
  } else if (holders < 100) {
    score += 1;
    results.push({
      icon: "⚠️",
      label: "Holders",
      text: `${holders} holders detected — still quite small, proceed carefully. (score +1)`,
      scoreDelta: 1
    });
  } else {
    results.push({
      icon: "✅",
      label: "Holders",
      text: `${holders} holders detected — more distributed, but still no guarantee of safety. (score +0)`,
      scoreDelta: 0
    });
  }

  /* --- 5.7 Contract verification (placeholder) --- */
  results.push({
    icon: "ℹ️",
    label: "Contract verification",
    text: "Verification status is not available from this testnet API. On mainnet, a non-verified contract would be a strong red flag.",
    scoreDelta: 0
  });

  /* --- 5.8 Honeypot checks (placeholder) --- */
  results.push({
    icon: "ℹ️",
    label: "Honeypot checks",
    text: "Static honeypot analysis (buy/sell simulation, blacklist checks) is not enabled on this testnet version.",
    scoreDelta: 0
  });

  /* --- 5.9 Creation age (placeholder) --- */
  results.push({
    icon: "ℹ️",
    label: "Creation age",
    text: "Creation block / age data is not exposed by this API on testnet. On mainnet, extremely new contracts are usually higher risk.",
    scoreDelta: 0
  });

  return results;
}

/* -----------------------------
   6. Small helpers for bullets
   ----------------------------- */

function addBullet(ul, icon, label, text) {
  const li = document.createElement("li");
  li.textContent = `${icon} ${label}: ${text}`;
  ul.appendChild(li);
}

function renderBullet(ul, item) {
  const li = document.createElement("li");
  li.textContent = `${item.icon} ${item.label}: ${item.text}`;
  ul.appendChild(li);
}
