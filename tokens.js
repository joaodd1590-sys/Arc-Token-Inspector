document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
  document.getElementById("tokenAddress").addEventListener("keydown", e => {
    if (e.key === "Enter") handleAnalyze();
  });
});

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
    /**
     * ÚNICA FONTE DE VERDADE:
     * Se o ArcScan retornar metadata de token → é token
     * Se não → wallet ou contrato não-token
     */
    const resp = await fetch(`/api/arc-token?address=${addr}&network=arcTestnet`);

    if (!resp.ok) {
      showNotTokenError();
      return;
    }

    const token = await resp.json();

    if (!token || (!token.name && !token.symbol)) {
      showNotTokenError();
      return;
    }

    fillTokenInfo(addr, token);
    applyRisk(token);
    showSuccess(addr);

  } catch (err) {
    console.error(err);
    showGenericError();
  }
}

/* =========================
   UI STATES
========================= */
function resetUI() {
  document.getElementById("riskCard").classList.add("hidden");
  document.getElementById("tokenCard").classList.add("hidden");
}

function showLoading() {
  const riskCard = document.getElementById("riskCard");
  riskCard.classList.remove("hidden");

  document.getElementById("riskPill").className = "risk-pill risk-unknown";
  document.getElementById("riskPill").textContent = "⏳ Loading";
  document.getElementById("riskTitle").textContent = "Analyzing address…";
  document.getElementById("riskDescription").textContent =
    "Checking ARC Testnet token registry.";
  document.querySelector(".risk-notes").innerHTML = "";
}

function showNotTokenError() {
  document.getElementById("riskCard").classList.remove("hidden");
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
  document.getElementById("riskCard").classList.remove("hidden");
  document.getElementById("riskPill").className = "risk-pill risk-danger";
  document.getElementById("riskPill").textContent = "❌ Error";
  document.getElementById("riskTitle").textContent =
    "Unable to analyze address.";
  document.getElementById("riskDescription").textContent =
    "Unexpected error occurred.";
}

function showSuccess(address) {
  document.getElementById("riskCard").classList.remove("hidden");
  document.getElementById("tokenCard").classList.remove("hidden");

  const explorer = document.getElementById("explorerLink");
  explorer.href = `https://testnet.arcscan.app/token/${address}`;
  explorer.style.display = "inline";
}

/* =========================
   TOKEN INFO
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
  const el = document.getElementById("tokenAddressShort");
  el.textContent = short;
  el.dataset.full = address;
}

/* =========================
   RISK ENGINE (HONESTA)
========================= */
function applyRisk(token) {
  const pill = document.getElementById("riskPill");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");
  const notes = document.querySelector(".risk-notes");

  let score = 0;
  notes.innerHTML = "";

  if (token.decimals === 0 || token.decimals === null) {
    score += 1;
    notes.innerHTML += `<li>⚠️ Token has unusual decimals.</li>`;
  }

  if (!token.totalSupply || token.totalSupply === "0") {
    score += 1;
    notes.innerHTML += `<li>⚠️ Total supply unavailable or zero.</li>`;
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
    desc.textContent =
      "Token has non-standard or incomplete metadata.";
  }
}

/* =========================
   UTILS
========================= */
function formatSupply(raw, dec) {
  try {
    const v = BigInt(raw);
    const d = BigInt(dec);
    return (v / 10n ** d).toLocaleString();
  } catch {
    return "-";
  }
}
