document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
  document.getElementById("tokenAddress").addEventListener("keydown", e => {
    if (e.key === "Enter") handleAnalyze();
  });
});

async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim().toLowerCase();

  if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
    alert("Invalid address format.");
    return;
  }

  resetUI();
  showLoading();

  try {
    const resp = await fetch(`/api/arc-token?address=${addr}`);

    if (!resp.ok) throw new Error("API error");

    const data = await resp.json();

    if (!data.isToken) {
      showNotTokenError();
      return;
    }

    fillTokenInfo(addr, data);
    applyRisk(data);
    showSuccess(addr);

  } catch (err) {
    console.error(err);
    showGenericError();
  }
}

/* UI States – unchanged except minor tweaks */
function resetUI() {
  document.getElementById("riskCard").classList.add("hidden");
  document.getElementById("tokenCard").classList.add("hidden");
}

function showLoading() {
  const riskCard = document.getElementById("riskCard");
  riskCard.classList.remove("hidden");

  document.getElementById("riskPill").className = "risk-pill risk-unknown";
  document.getElementById("riskPill").textContent = "⏳ Analyzing";
  document.getElementById("riskTitle").textContent = "Querying ARC Testnet…";
  document.getElementById("riskDescription").textContent = "Fetching token metadata via direct RPC calls.";
  document.querySelector(".risk-notes").innerHTML = "";
}

function showNotTokenError() {
  document.getElementById("riskCard").classList.remove("hidden");
  document.getElementById("riskPill").className = "risk-pill risk-warning";
  document.getElementById("riskPill").textContent = "⚠️ Not a token";
  document.getElementById("riskTitle").textContent = "Address is not an ARC-20 token contract";
  document.getElementById("riskDescription").textContent = "No valid ERC-20 metadata detected (requires at least 2 of: name, symbol, decimals, totalSupply).";
  document.querySelector(".risk-notes").innerHTML = `
    <li>Likely a wallet (EOA) or non-token contract.</li>
  `;
}

function showGenericError() {
  document.getElementById("riskCard").classList.remove("hidden");
  document.getElementById("riskPill").className = "risk-pill risk-danger";
  document.getElementById("riskPill").textContent = "❌ Error";
  document.getElementById("riskTitle").textContent = "Failed to analyze address";
  document.getElementById("riskDescription").textContent = "RPC or network error.";
}

function showSuccess(address) {
  document.getElementById("riskCard").classList.remove("hidden");
  document.getElementById("tokenCard").classList.remove("hidden");

  const explorer = document.getElementById("explorerLink");
  explorer.href = `https://testnet.arcscan.app/address/${address}`;
  explorer.style.display = "inline";
}

function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name || "Unknown";
  document.getElementById("tSymbol").textContent = token.symbol || "???";
  document.getElementById("tDecimals").textContent = token.decimals ?? "unknown";
  document.getElementById("tSupplyRaw").textContent = token.totalSupply || "-";
  document.getElementById("tSupplyHuman").textContent = formatSupply(token.totalSupply, token.decimals);

  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const el = document.getElementById("tokenAddressShort");
  el.textContent = short;
  el.dataset.full = address;
}

function applyRisk(token) {
  const pill = document.getElementById("riskPill");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");
  const notes = document.querySelector(".risk-notes");

  let issues = 0;
  notes.innerHTML = "";

  if (token.decimals === 0 || token.decimals === null || token.decimals === undefined) {
    issues++;
    notes.innerHTML += `<li>⚠️ Unusual or missing decimals</li>`;
  }

  if (!token.totalSupply || token.totalSupply === "0") {
    issues++;
    notes.innerHTML += `<li>⚠️ Total supply zero or unavailable</li>`;
  }

  if (issues === 0) {
    pill.textContent = "🟢 Likely Safe";
    pill.className = "risk-pill risk-safe";
    title.textContent = "No major red flags";
    desc.textContent = "Standard ERC-20 metadata detected.";
  } else {
    pill.textContent = "⚠️ Potential Risk";
    pill.className = "risk-pill risk-warning";
    title.textContent = "Some anomalies detected";
    desc.textContent = "Review metadata carefully before interacting.";
  }
}

function formatSupply(raw, dec) {
  if (!raw || dec === null || dec === undefined) return "-";
  try {
    const v = BigInt(raw);
    const d = BigInt(dec);
    return Number(v / 10n ** d).toLocaleString();
  } catch {
    return "-";
  }
}
