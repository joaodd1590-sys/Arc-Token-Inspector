// Known trusted tokens
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
});

async function handleAnalyze() {
  const address = document.getElementById("tokenAddress").value.trim();
  const status = document.getElementById("statusMsg");

  if (!address.startsWith("0x") || address.length < 10) {
    alert("Please enter a valid contract address.");
    return;
  }

  status.textContent = "Loading token data…";

  try {
    const resp = await fetch(`/api/arc-token?address=${address}`);
    const data = await resp.json();

    if (!resp.ok || !data.name) {
      status.textContent = "Error loading token.";
      return;
    }

    fillTokenInfo(address, data);
    applyRisk(address, data);
    renderWhy(address, data);

    document.getElementById("riskCard").classList.remove("hidden");
    document.getElementById("tokenCard").classList.remove("hidden");
    document.getElementById("whySection").classList.remove("hidden");

    status.textContent =
      "Token loaded successfully. Always cross-check with the official explorer.";

  } catch (err) {
    console.error(err);
    status.textContent = "Error loading token.";
  }
}

function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent = token.decimals ?? "-";
  document.getElementById("tSupplyRaw").textContent = token.totalSupply || "-";
  document.getElementById("tSupplyHuman").textContent =
    formatHuman(token.totalSupply, token.decimals);

  document.getElementById("tokenTitle").textContent =
    `${token.name} (${token.symbol})`;

  document.getElementById("tokenAddressShort").textContent =
    address.slice(0, 6) + "..." + address.slice(-4);

  const avatar = document.getElementById("tokenAvatar");
  avatar.textContent = (token.symbol?.[0] || "?").toUpperCase();
}

function formatHuman(raw, decimals) {
  if (!raw) return "-";
  const big = BigInt(raw);
  const factor = 10n ** BigInt(decimals || 0);
  const whole = big / factor;
  return whole.toLocaleString();
}

// RISK SCORING
function applyRisk(address, token) {
  const pill = document.getElementById("riskPill");
  const verified = document.getElementById("verifiedBadge");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");

  pill.className = "risk-pill risk-unknown";
  verified.classList.add("hidden");

  const isTrusted = TRUSTED_TOKENS[address.toLowerCase()];

  let score = 0;

  // decimals rule
  if (token.decimals === 0 || token.decimals > 18) score += 2;

  // supply
  if (!token.totalSupply || token.totalSupply === "0") score += 2;

  // name/symbol
  if (!token.symbol || token.symbol.length < 2) score += 1;

  let level = "safe";
  if (score >= 5) level = "danger";
  else if (score >= 3) level = "warning";
  else if (score >= 1) level = "caution";

  if (isTrusted) {
    pill.textContent = "Trusted";
    pill.classList.add("risk-safe");
    verified.classList.remove("hidden");
    title.textContent = token.symbol + " is marked as trusted.";
    desc.textContent = isTrusted.note;
    return;
  }

  if (level === "safe") {
    pill.textContent = "Likely Safe";
    pill.classList.add("risk-safe");
    title.textContent = "No major red flags detected.";
    desc.textContent = "Heuristic evaluation passed.";
  } else if (level === "caution") {
    pill.textContent = "Caution";
    pill.classList.add("risk-warning");
    title.textContent = "Some unusual characteristics detected.";
    desc.textContent = "Review contract and metadata.";
  } else if (level === "warning") {
    pill.textContent = "Risky";
    pill.classList.add("risk-warning");
    title.textContent = "Multiple suspicious properties.";
    desc.textContent =
      "Token configurations suggest elevated risk; proceed carefully.";
  } else {
    pill.textContent = "High Risk";
    pill.classList.add("risk-danger");
    title.textContent = "Severe red flags detected.";
    desc.textContent = "Avoid interacting with this contract.";
  }
}

// WHY SECTION
function renderWhy(address, token) {
  const list = document.getElementById("whyList");
  list.innerHTML = "";

  const rules = [];

  rules.push(
    token.decimals === 0
      ? "⚠️ Decimals: Token has 0 decimals — uncommon configuration."
      : "✔ Decimals: Value appears normal."
  );

  rules.push(
    (!token.symbol || token.symbol.length < 2)
      ? "⚠️ Name/Symbol: Symbol too short or malformed."
      : "✔ Name/Symbol: Appears valid."
  );

  rules.push(
    token.totalSupply === "0"
      ? "⚠️ Total Supply: Zero supply suggests token may be broken."
      : "✔ Total Supply: Supply appears normal."
  );

  rules.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r;
    list.appendChild(li);
  });
}
