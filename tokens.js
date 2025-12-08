const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official ARC USDC (Testnet)"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").onclick = analyzeToken;
  document.getElementById("themeToggle").onclick = () =>
    document.body.classList.toggle("dark");

  // block mainnet option
  document.getElementById("networkSelect").addEventListener("change", (e) => {
    if (e.target.value === "mainnet") {
      alert("Mainnet support is coming soon!");
      e.target.value = "testnet";
    }
  });
});

async function analyzeToken() {
  const address = document.getElementById("tokenAddress").value.trim();
  const status = document.getElementById("statusMsg");

  if (!address.startsWith("0x") || address.length < 20) {
    alert("Enter a valid ARC-20 contract address.");
    return;
  }

  status.textContent = "Loading token...";
  hideCards();

  try {
    const resp = await fetch(`/api/arc-token?address=${address}`);
    const token = await resp.json();

    if (!token || !token.symbol) {
      status.textContent = "Token not found.";
      return;
    }

    fillTokenInfo(address, token);
    applyRisk(address, token);

    document.getElementById("tokenCard").classList.remove("hidden");
    document.getElementById("riskCard").classList.remove("hidden");

    status.textContent = "Token loaded successfully.";
  } catch (e) {
    status.textContent = "Failed to load token.";
  }
}

function hideCards() {
  document.getElementById("riskCard").classList.add("hidden");
  document.getElementById("tokenCard").classList.add("hidden");
}

function fillTokenInfo(addr, token) {
  document.getElementById("tName").textContent = token.name;
  document.getElementById("tSymbol").textContent = token.symbol;
  document.getElementById("tDecimals").textContent = token.decimals;
  document.getElementById("tSupplyRaw").textContent = token.totalSupply;

  const human = formatHuman(token.totalSupply, token.decimals);
  document.getElementById("tSupplyHuman").textContent = human;

  document.getElementById("tokenAvatar").textContent =
    token.symbol?.[0]?.toUpperCase() || "?";

  document.getElementById("tokenTitle").textContent =
    `${token.name} (${token.symbol})`;

  document.getElementById("tokenAddressShort").textContent =
    addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatHuman(raw, decimals) {
  try {
    const big = BigInt(raw);
    const factor = BigInt(10) ** BigInt(decimals);
    return (big / factor).toLocaleString();
  } catch {
    return raw;
  }
}

function applyRisk(addr, token) {
  const pill = document.getElementById("riskPill");
  const badge = document.getElementById("verifiedBadge");
  const why = document.getElementById("whyList");

  pill.className = "risk-pill risk-unknown";
  badge.classList.add("hidden");
  why.innerHTML = "";

  const normalized = addr.toLowerCase();

  let score = 0;
  const reasons = [];

  // trusted list
  if (TRUSTED_TOKENS[normalized]) {
    pill.textContent = "Trusted";
    pill.classList.add("risk-safe");
    badge.classList.remove("hidden");
    reasons.push("✔ Official trusted ARC token.");
    renderWhy(reasons);
    return;
  }

  // decimals
  if (token.decimals === 0 || token.decimals > 18) {
    score += 2;
    reasons.push("⚠ Unusual decimals.");
  } else {
    reasons.push("✔ Decimals look normal.");
  }

  // symbol
  if (!token.symbol || token.symbol.length < 2) {
    score += 1;
    reasons.push("⚠ Symbol too short.");
  } else {
    reasons.push("✔ Symbol format looks normal.");
  }

  // supply
  try {
    const supply = BigInt(token.totalSupply);
    if (supply === 0n) {
      score += 2;
      reasons.push("⚠ Zero supply — suspicious.");
    } else {
      reasons.push("✔ Supply looks normal.");
    }
  } catch {
    score += 1;
    reasons.push("⚠ Supply could not be verified.");
  }

  // address pattern
  if (normalized.startsWith("0x000000")) {
    score += 1;
    reasons.push("⚠ Address pattern is unusual.");
  } else {
    reasons.push("✔ Address pattern looks normal.");
  }

  // assign level
  if (score >= 5) {
    pill.textContent = "High Risk";
    pill.classList.add("risk-danger", "glow-danger");
  } else if (score >= 3) {
    pill.textContent = "Risky";
    pill.classList.add("risk-warning");
  } else if (score >= 1) {
    pill.textContent = "Caution";
    pill.classList.add("risk-warning");
  } else {
    pill.textContent = "Likely Safe";
    pill.classList.add("risk-safe");
  }

  renderWhy(reasons);
}

function renderWhy(list) {
  const ul = document.getElementById("whyList");
  ul.innerHTML = "";
  list.forEach(reason => {
    const li = document.createElement("li");
    li.textContent = reason;
    ul.appendChild(li);
  });
}
