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
   MAIN FLOW
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
    const resp = await fetch(`/api/arc-token?address=${addr}&network=arcTestnet`);
    if (!resp.ok) return showNotTokenError();

    const token = await resp.json();
    if (!token || (!token.name && !token.symbol)) {
      return showNotTokenError();
    }

    fillTokenInfo(addr, token);
    applyRisk(token);
    renderV3Capabilities();
    renderV4Advanced();
    renderV5Execution(); // 👈 V5
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
  document.getElementById("v3Card")?.classList.add("hidden");
  document.getElementById("v4Card")?.classList.add("hidden");
  document.getElementById("v5Card")?.classList.add("hidden");
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
    "This address does not appear in the ARC Testnet token registry.";

  document.querySelector(".risk-notes").innerHTML = `
    <li>Likely a wallet or non-token contract.</li>
    <li>Only ARC-20 token contracts can be analyzed.</li>
  `;
}

function showGenericError() {
  document.getElementById("riskCard")?.classList.remove("hidden");
  document.getElementById("riskPill").className = "risk-pill risk-danger";
  document.getElementById("riskPill").textContent = "❌ Error";
  document.getElementById("riskTitle").textContent =
    "Unable to analyze address.";
  document.getElementById("riskDescription").textContent =
    "Unexpected error occurred.";
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
  document.getElementById("tDecimals").textContent = token.decimals ?? "unknown";
  document.getElementById("tSupplyRaw").textContent = token.totalSupply || "-";
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
   RISK ENGINE
========================= */
function applyRisk(token) {
  const pill = document.getElementById("riskPill");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");
  const notes = document.querySelector(".risk-notes");

  let score = 0;
  notes.innerHTML = "";

  if (token.decimals === 0 || token.decimals == null) {
    score++;
    notes.innerHTML += `<li>⚠️ Unusual decimals</li>`;
  }

  if (!token.totalSupply || token.totalSupply === "0") {
    score++;
    notes.innerHTML += `<li>⚠️ Total supply unavailable</li>`;
  }

  if (score === 0) {
    pill.textContent = "🟢 Likely Safe";
    pill.className = "risk-pill risk-safe";
    title.textContent = "No major red flags detected.";
    desc.textContent = "Token metadata looks standard.";
  } else {
    pill.textContent = "⚠️ Risky";
    pill.className = "risk-pill risk-warning";
    title.textContent = "Some risk indicators detected.";
    desc.textContent = "Review metadata carefully.";
  }
}

/* =========================
   V3 – CONTRACT CAPABILITIES
========================= */
function renderV3Capabilities() {
  const card = document.getElementById("v3Card");
  if (!card) return;

  card.classList.remove("hidden");
  card.innerHTML = `
    <h3>Contract Capabilities</h3>
    <ul class="v3-list">
      <li>👑 Owner() <span>(Mainnet only)</span></li>
      <li>⏸ Pause / Unpause <span>(Mainnet only)</span></li>
      <li>🪙 Mint <span>(Mainnet only)</span></li>
      <li>🔥 Burn <span>(Mainnet only)</span></li>
      <li>🚫 Blacklist <span>(Mainnet only)</span></li>
      <li>🔁 Upgradeable / Proxy <span>(Mainnet only)</span></li>
    </ul>
  `;
}

/* =========================
   V4 – ADVANCED ANALYSIS
========================= */
function renderV4Advanced() {
  const card = document.getElementById("v4Card");
  if (!card) return;

  card.classList.remove("hidden");
  card.innerHTML = `
    <h3>Advanced Contract Analysis (V4)</h3>
    <ul class="v4-list">
      <li>🔒 owner() <span>Mainnet required</span></li>
      <li>🔒 paused() <span>Mainnet required</span></li>
      <li>🔒 mint() <span>Mainnet required</span></li>
      <li>🔒 burn() <span>Mainnet required</span></li>
      <li>🔒 blacklist() <span>Mainnet required</span></li>
      <li>🔒 proxy / implementation <span>Mainnet required</span></li>
    </ul>
  `;
}

/* =========================
   V5 – EXECUTION & PERMISSIONS
========================= */
function renderV5Execution() {
  const card = document.getElementById("v5Card");
  if (!card) return;

  card.classList.remove("hidden");
  card.innerHTML = `
    <h3>Execution & Permissions (V5)</h3>
    <ul class="v5-list">
      <li>⚠️ Centralized control detected <span>Mainnet required</span></li>
      <li>⚠️ Privileged roles may exist <span>Mainnet required</span></li>
      <li>⚠️ Token supply may be mutable <span>Mainnet required</span></li>
      <li>⚠️ Transfers could be paused <span>Mainnet required</span></li>
      <li>⚠️ Blacklist / denylist possible <span>Mainnet required</span></li>
    </ul>
    <p class="v5-note">
      This section becomes active once Mainnet analysis is enabled.
    </p>
  `;
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
