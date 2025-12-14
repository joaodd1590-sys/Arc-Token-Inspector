document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const input = document.getElementById("tokenAddress");

  if (analyzeBtn) analyzeBtn.addEventListener("click", handleAnalyze);
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") handleAnalyze();
    });
  }

  initThemeToggle();
});

/* =========================
   DARK / LIGHT MODE
========================= */
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  const saved = localStorage.getItem("theme") || "dark";
  document.body.setAttribute("data-theme", saved);
  btn.textContent = saved === "dark" ? "🌙" : "☀️";

  btn.addEventListener("click", () => {
    const next =
      document.body.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    document.body.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    btn.textContent = next === "dark" ? "🌙" : "☀️";
  });
}

/* =========================
   MAIN ANALYSIS FLOW
========================= */
async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();

  if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
    alert("Invalid address format.");
    return;
  }

  resetUI();
  showLoading();

  try {
    const resp = await fetch(
      `/api/arc-token?address=${addr}&network=arcTestnet`
    );

    if (!resp.ok) return showNotTokenError();

    const token = await resp.json();
    if (!token || (!token.name && !token.symbol)) {
      return showNotTokenError();
    }

    fillTokenInfo(addr, token);
    applyRisk(token);
    showSuccess(addr);

  } catch (e) {
    console.error(e);
    showGenericError();
  }
}

/* =========================
   UI STATES
========================= */
function resetUI() {
  document.getElementById("riskCard")?.classList.add("hidden");
  document.getElementById("tokenCard")?.classList.add("hidden");
}

function showLoading() {
  document.getElementById("riskCard")?.classList.remove("hidden");

  document.getElementById("riskPill").className = "risk-pill risk-unknown";
  document.getElementById("riskPill").textContent = "⏳ Loading";
  document.getElementById("riskTitle").textContent = "Analyzing address…";
  document.getElementById("riskDescription").textContent =
    "Checking ARC Testnet token registry.";
  document.querySelector(".risk-notes").innerHTML = "";
}

function showNotTokenError() {
  document.getElementById("riskCard")?.classList.remove("hidden");

  document.getElementById("riskPill").className = "risk-pill risk-warning";
  document.getElementById("riskPill").textContent = "⚠️ Invalid input";
  document.getElementById("riskTitle").textContent =
    "Address is not an ARC-20 token";
  document.getElementById("riskDescription").textContent =
    "This address does not appear to be a valid ARC token contract.";

  document.querySelector(".risk-notes").innerHTML = `
    <li>Likely a wallet or non-token contract.</li>
    <li>Only ARC-20 token contracts are supported.</li>
  `;
}

function showGenericError() {
  document.getElementById("riskCard")?.classList.remove("hidden");

  document.getElementById("riskPill").className = "risk-pill risk-danger";
  document.getElementById("riskPill").textContent = "❌ Error";
  document.getElementById("riskTitle").textContent =
    "Unable to analyze address.";
  document.getElementById("riskDescription").textContent =
    "Unexpected network or RPC error.";
}

function showSuccess(address) {
  document.getElementById("riskCard")?.classList.remove("hidden");
  document.getElementById("tokenCard")?.classList.remove("hidden");

  const explorer = document.getElementById("explorerLink");
  if (explorer) {
    explorer.href = `https://testnet.arcscan.app/token/${address}`;
    explorer.style.display = "inline";
  }
}

/* =========================
   TOKEN INFO + ICON
========================= */
function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name || "Unknown";
  document.getElementById("tSymbol").textContent = token.symbol || "???";
  document.getElementById("tDecimals").textContent =
    token.decimals ?? "unknown";
  document.getElementById("tSupplyRaw").textContent =
    token.totalSupply || "-";
  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const addrEl = document.getElementById("tokenAddressShort");
  addrEl.textContent = short;
  addrEl.dataset.full = address;

  const avatar = document.getElementById("tokenAvatar");
  if (!avatar) return;

  avatar.innerHTML = "";
  const img = new Image();
  img.src = `https://testnet.arcscan.app/token/images/${address}.png`;
  img.className = "token-icon-img";

  img.onload = () => avatar.appendChild(img);
  img.onerror = () => {
    avatar.textContent = (token.symbol || "?")[0];
  };
}

/* =========================
   RISK ENGINE — FINAL
========================= */
function applyRisk(token) {
  const pill = document.getElementById("riskPill");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");
  const notes = document.querySelector(".risk-notes");

  let score = 0;
  notes.innerHTML = "";

  // Decimals
  if (token.decimals == null) {
    score += 2;
    notes.innerHTML += `<li>⚠️ Token does not report decimals</li>`;
  } else if (token.decimals === 0) {
    score += 1;
    notes.innerHTML += `<li>⚠️ Token uses 0 decimals (non-standard)</li>`;
  } else if (token.decimals > 18) {
    score += 1;
    notes.innerHTML += `<li>⚠️ Unusually high decimals</li>`;
  }

  // Supply
  if (!token.totalSupply || token.totalSupply === "0") {
    score += 2;
    notes.innerHTML += `<li>⚠️ Total supply unavailable or zero</li>`;
  } else {
    try {
      const supply = BigInt(token.totalSupply);
      if (supply > 10n ** 30n) {
        score += 1;
        notes.innerHTML += `<li>⚠️ Extremely large total supply</li>`;
      }
    } catch {
      score += 1;
      notes.innerHTML += `<li>⚠️ Total supply could not be parsed</li>`;
    }
  }

  // Metadata
  if (!token.name) {
    score += 1;
    notes.innerHTML += `<li>⚠️ Token name is missing</li>`;
  }

  if (!token.symbol) {
    score += 1;
    notes.innerHTML += `<li>⚠️ Token symbol is missing</li>`;
  }

  // Verdict
  if (score === 0) {
    pill.textContent = "🟢 Likely Safe";
    pill.className = "risk-pill risk-safe";
    title.textContent = "No major red flags detected";
    desc.textContent =
      "Token metadata follows common ARC-20 standards.";
  } else if (score <= 2) {
    pill.textContent = "⚠️ Potential Risk";
    pill.className = "risk-pill risk-warning";
    title.textContent = "Some anomalies detected";
    desc.textContent =
      "Token shows non-standard or incomplete metadata.";
  } else {
    pill.textContent = "❌ High Risk";
    pill.className = "risk-pill risk-danger";
    title.textContent = "Multiple red flags detected";
    desc.textContent =
      "Token metadata is incomplete or highly unusual.";
  }
}

/* =========================
   UTILS
========================= */
function formatSupply(raw, dec) {
  try {
    return (BigInt(raw) / 10n ** BigInt(dec)).toLocaleString();
  } catch {
    return "-";
  }
}
