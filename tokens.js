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
    /* 1️⃣ Detect address type (server-side, no CORS issues) */
    const detectRes = await fetch(`/api/detect-address?address=${addr}`);
    const detect = await detectRes.json();

    if (detect.type === "wallet") {
      showWalletError();
      return;
    }

    if (detect.type === "contract" && !detect.erc20) {
      showNotTokenError();
      return;
    }

    /* 2️⃣ Load token metadata */
    const resp = await fetch(`/api/arc-token?address=${addr}&network=arcTestnet`);
    const token = await resp.json();

    fillTokenInfo(addr, token);
    applyRisk(addr, token);

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

  document.getElementById("riskPill").textContent = "⏳ Loading";
  document.getElementById("riskTitle").textContent = "Analyzing address…";
  document.getElementById("riskDescription").textContent =
    "Detecting address type and token metadata.";
  document.querySelector(".risk-notes").innerHTML = "";
}

function showWalletError() {
  document.getElementById("riskPill").textContent = "⚠️ Invalid input";
  document.getElementById("riskTitle").textContent = "Wallet address detected.";
  document.getElementById("riskDescription").textContent =
    "This tool analyzes ARC-20 token contracts only.";
}

function showNotTokenError() {
  document.getElementById("riskPill").textContent = "⚠️ Not a token";
  document.getElementById("riskTitle").textContent =
    "Address is not an ARC-20 token.";
  document.getElementById("riskDescription").textContent =
    "The contract does not expose standard ERC-20 interfaces.";
}

function showGenericError() {
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
   BASIC RISK ENGINE
========================= */
function applyRisk(address, token) {
  const pill = document.getElementById("riskPill");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");
  const notes = document.querySelector(".risk-notes");

  let score = 0;
  notes.innerHTML = "";

  if (!token.decimals || token.decimals === 0) {
    score += 2;
    notes.innerHTML += `<li>⚠️ Token has unusual decimals.</li>`;
  }

  if (!token.totalSupply || token.totalSupply === "0") {
    score += 2;
    notes.innerHTML += `<li>⚠️ Total supply is zero or unavailable.</li>`;
  }

  if (score === 0) {
    pill.textContent = "🟢 Likely Safe";
    pill.className = "risk-pill risk-safe";
    title.textContent = "No major red flags detected.";
    desc.textContent = "Token structure looks standard.";
  } else {
    pill.textContent = "⚠️ Risky";
    pill.className = "risk-pill risk-warning";
    title.textContent = "Several red flags detected.";
    desc.textContent =
      "Interact only if you fully understand the risks.";
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
