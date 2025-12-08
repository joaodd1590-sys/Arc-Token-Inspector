// Known trusted tokens on ARC (you can add more here)
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("analyzeBtn");
  btn.addEventListener("click", handleAnalyze);
});

async function handleAnalyze() {
  const input = document.getElementById("tokenAddress");
  const address = (input.value || "").trim();

  if (!address || !address.startsWith("0x") || address.length < 10) {
    alert("Please enter a valid token contract address (0x...).");
    return;
  }

  const tokenCard = document.getElementById("tokenCard");
  const riskCard = document.getElementById("riskCard");
  const statusMsg = document.getElementById("statusMsg");

  tokenCard.classList.add("hidden");
  riskCard.classList.add("hidden");
  statusMsg.textContent = "Loading token data from ARC public API...";

  try {
    const resp = await fetch(`/api/arc-token?address=${address}`);
    const data = await resp.json();

    if (!resp.ok || !data || !data.name) {
      statusMsg.textContent = "Token not found or API returned an error.";
      return;
    }

    // Fill token info
    fillTokenInfo(address, data);

    // Compute risk signal
    applyRiskSignal(address, data);

    tokenCard.classList.remove("hidden");
    riskCard.classList.remove("hidden");
    statusMsg.textContent =
      "Token loaded successfully. Always cross-check with the official explorer.";

  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Failed to load token data.";
  }
}

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
    // show only first 4 decimals for UI
    fracStr = fracStr.slice(0, 4);

    return `${intPart.toLocaleString("en-US")}.${fracStr}`;
  } catch (e) {
    return raw;
  }
}

/**
 * Heuristic risk signal
 * - trusted if in allowlist
 * - else score based on decimals, name/symbol length, totalSupply, address pattern
 */
function applyRiskSignal(address, token) {
  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];

  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");
  const verifiedBadge = document.getElementById("verifiedBadge");

  // reset classes
  riskPill.className = "risk-pill risk-unknown";
  verifiedBadge.classList.add("hidden");

  if (trusted) {
    // Trusted token
    riskPill.textContent = "Trusted";
    riskPill.classList.add("risk-safe");
    verifiedBadge.classList.remove("hidden");
    riskTitle.textContent = `${token.symbol || "Token"} is marked as trusted.`;
    riskDesc.textContent =
      trusted.note +
      " · Still, always verify URLs, contracts and official documentation.";
    return;
  }

  // Heuristic scoring
  let score = 0;

  const decimals = Number(token.decimals || 0);
  const supplyStr = token.totalSupply || "0";
  let supply = 0n;
  try {
    supply = BigInt(supplyStr);
  } catch {}

  // suspicious decimals
  if (decimals > 18 || decimals === 0) score += 2;

  // weird name/symbol
  if (!token.name || token.name.length < 3) score += 1;
  if (!token.symbol || token.symbol.length < 2 || token.symbol.length > 8)
    score += 1;

  // extremely small or huge supply
  if (supply === 0n) score += 2;
  if (supply > 10n ** 40n) score += 2;

  // address pattern
  if (normalized.startsWith("0x000000")) score += 2;

  // Map score -> level
  let level = "safe";
  if (score >= 5) level = "danger";
  else if (score >= 3) level = "warning";
  else if (score >= 1) level = "caution";

  // Apply UI
  if (level === "safe") {
    riskPill.textContent = "Likely Safe";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "No obvious red flags detected.";
    riskDesc.textContent =
      "Basic heuristics did not detect major issues. This does NOT guarantee safety — always DYOR.";
  } else if (level === "caution") {
    riskPill.textContent = "Caution";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Some mildly suspicious characteristics.";
    riskDesc.textContent =
      "Symbol/name or supply configuration look a bit unusual. Review the contract and project carefully.";
  } else if (level === "warning") {
    riskPill.textContent = "Risky";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Several red flags found.";
    riskDesc.textContent =
      "Decimals, supply or address pattern look quite suspicious. Treat this token as high risk.";
  } else {
    riskPill.textContent = "High Risk";
    riskPill.classList.add("risk-danger");
    riskTitle.textContent = "Strong red flags — avoid interacting.";
    riskDesc.textContent =
      "On-chain metadata strongly suggests this may be a scam or broken token. Do NOT use this contract.";
  }
}
