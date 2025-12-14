// ===============================
// ARC Token Inspector - tokens.js
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
  document.getElementById("tokenAddress").addEventListener("keydown", e => {
    if (e.key === "Enter") handleAnalyze();
  });
});

/* -------------------------
   Main Analyze Handler
--------------------------*/
async function handleAnalyze() {
  const input = document.getElementById("tokenAddress");
  const address = input.value.trim();

  resetUI();

  // Basic address validation
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    alert("Invalid address format.");
    return;
  }

  showLoading();

  try {
    const resp = await fetch(`/api/arc-token?address=${address}`);
    const data = await resp.json();

    // Not a token → wallet or non-token contract
    if (!data.ok || data.type !== "token") {
      showNotTokenError();
      return;
    }

    // Token found
    fillTokenInfo(address, data.token);
    applyRisk(data.token);
    showSuccess(address);

  } catch (err) {
    console.error(err);
    showGenericError();
  }
}

/* -------------------------
   UI States
--------------------------*/
function resetUI() {
  document.getElementById("riskCard").classList.add("hidden");
  document.getElementById("tokenCard").classList.add("hidden");
}

function showLoading() {
  const card = document.getElementById("riskCard");
  card.classList.remove("hidden");

  document.getElementById("riskPill").className = "risk-pill risk-unknown";
  document.getElementById("riskPill").textContent = "⏳ Loading";
  document.getElementById("riskTitle").textContent = "Analyzing address…";
  document.getElementById("riskDescription").textContent =
    "Checking ARC Testnet token registry.";

  document.querySelector(".risk-notes").innerHTML = `
    <li>Please wait while we verify the address.</li>
  `;
}

function showNotTokenError() {
  const card = document.getElementById("riskCard");
  card.classList.remove("hidden");

  document.getElementById("riskPill").className = "risk-pill risk-warning";
  document.getElementById("riskPill").textContent = "⚠️ Invalid input";
  document.getElementById("riskTitle").textContent =
    "Address is not an ARC-20 token";
  document.getElementById("riskDescription").textContent =
    "This address does not appear in the ARC Testnet token registry.";

  document.querySelector(".risk-notes").innerHTML = `
    <li>Likely a wallet address or non-token contract.</li>
    <li>Only ARC-20 token contracts can be analyzed.</li>
  `;
}

function showGenericError() {
  const card = document.getElementById("riskCard");
  card.classList.remove("hidden");

  document.getElementById("riskPill").className = "risk-pill risk-danger";
  document.getElementById("riskPill").textContent = "❌ Error";
  document.getElementById("riskTitle").textContent =
    "Unable to analyze address";
  document.getElementById("riskDescription").textContent =
    "An unexpected error occurred. Please try again.";

  document.querySelector(".risk-notes").innerHTML = `
    <li>Network or server error.</li>
  `;
}

function showSuccess(address) {
  document.getElementById("riskCard").classList.remove("hidden");
  document.getElementById("tokenCard").classList.remove("hidden");

  const explorerLink = document.getElementById("explorerLink");
  explorerLink.href = `https://testnet.arcscan.app/token/${address}`;
  explorerLink.textContent = "View on explorer ↗";
  explorerLink.style.display = "inline";
}

/* -------------------------
   Token Info
--------------------------*/
function fillTokenInfo(address, token) {
  document.getElementById("tokenTitle").textContent =
    `${token.name} (${token.symbol})`;

  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent =
    token.decimals ?? "-";
  document.getElementById("tSupplyRaw").textContent =
    token.totalSupply || "-";
  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const addrEl = document.getElementById("tokenAddressShort");
  addrEl.textContent = short;
  addrEl.dataset.full = address;

  document.getElementById("tokenAvatar").textContent =
    (token.symbol?.[0] || "?").toUpperCase();
}

/* -------------------------
   Risk Engine (Honest)
--------------------------*/
function applyRisk(token) {
  const pill = document.getElementById("riskPill");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");
  const notes = document.querySelector(".risk-notes");

  let score = 0;
  notes.innerHTML = "";

  if (token.decimals === 0 || token.decimals == null) {
    score++;
    notes.innerHTML += `<li>⚠️ Unusual or missing decimals.</li>`;
  }

  if (!token.totalSupply || token.totalSupply === "0") {
    score++;
    notes.innerHTML += `<li>⚠️ Total supply unavailable or zero.</li>`;
  }

  if (score === 0) {
    pill.className = "risk-pill risk-safe";
    pill.textContent = "🟢 Likely Safe";
    title.textContent = "No major red flags detected.";
    desc.textContent = "Token metadata looks standard.";
  } else {
    pill.className = "risk-pill risk-warning";
    pill.textContent = "⚠️ Risky";
    title.textContent = "Some risk indicators detected.";
    desc.textContent =
      "Token metadata shows non-standard patterns.";
  }

  notes.innerHTML += `
    <li>Read-only heuristic analysis.</li>
    <li>No wallet connection required.</li>
  `;
}

/* -------------------------
   Utils
--------------------------*/
function formatSupply(raw, decimals) {
  try {
    if (!raw || decimals == null) return "-";
    const v = BigInt(raw);
    const d = BigInt(decimals);
    return (v / 10n ** d).toLocaleString();
  } catch {
    return "-";
  }
}
