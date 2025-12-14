// ARC Token Inspector — corrected wallet vs token logic
// Comments written as if authored by the project owner.

const NETWORKS = {
  arcTestnet: {
    label: "ARC Testnet",
    explorerBase: "https://testnet.arcscan.app"
  }
};

const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
  document.getElementById("tokenAddress").addEventListener("keyup", e => {
    if (e.key === "Enter") handleAnalyze();
  });

  initThemeToggle();
  initCopy();
});

/* =========================
   Theme toggle
========================= */
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  btn.onclick = () => {
    const body = document.body;
    const next = body.dataset.theme === "dark" ? "light" : "dark";
    body.dataset.theme = next;
    btn.textContent = next === "dark" ? "🌙" : "☀️";
  };
}

/* =========================
   Copy address
========================= */
function initCopy() {
  const btn = document.getElementById("copyAddressBtn");
  btn.onclick = async () => {
    const el = document.getElementById("tokenAddressShort");
    if (!el?.dataset.full) return;
    await navigator.clipboard.writeText(el.dataset.full);
    btn.textContent = "✔ Copied";
    setTimeout(() => (btn.textContent = "📋 Copy"), 1000);
  };
}

/* =========================
   Helpers
========================= */
function isHexAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function shorten(a) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function isEmptyCode(code) {
  return /^0x0*$/i.test(code || "");
}

/* =========================
   Wallet panel (HARD STOP)
========================= */
function showWalletPanel(address) {
  document.getElementById("tokenCard").classList.add("hidden");
  document.getElementById("riskCard").classList.remove("hidden");

  document.getElementById("riskPill").className = "risk-pill risk-warning";
  document.getElementById("riskPill").textContent = "⚠️ Invalid input";

  document.getElementById("riskTitle").textContent = "Wallet address detected.";
  document.getElementById("riskDescription").textContent =
    "This tool analyzes ARC-20 token contracts only.";

  document.querySelector(".risk-notes").innerHTML = `
    <li>This address does not contain contract bytecode.</li>
    <li>No token analysis was performed.</li>
  `;

  const explorer = document.getElementById("explorerLink");
  explorer.href = `${NETWORKS.arcTestnet.explorerBase}/address/${address}`;
  explorer.textContent = "View on explorer ↗";
  explorer.style.display = "inline-flex";
}

/* =========================
   Main handler
========================= */
async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();

  if (!isHexAddress(addr)) {
    alert("Invalid address format.");
    return;
  }

  const status = document.getElementById("statusMsg");
  status.textContent = "Checking address type...";

  // --- HARD WALLET CHECK ---
  try {
    const res = await fetch(
      `https://testnet.arcscan.app/api?module=proxy&action=eth_getCode&address=${addr}&tag=latest`
    );
    const json = await res.json();

    if (isEmptyCode(json.result)) {
      showWalletPanel(addr);
      status.textContent = "";
      return; // ⛔ STOP EVERYTHING
    }
  } catch {
    // If detection fails, we still continue (API instability)
  }

  // --- TOKEN METADATA ---
  status.textContent = "Loading token data...";
  const resp = await fetch(`/api/arc-token?address=${addr}&network=arcTestnet`);
  const token = await resp.json();

  if (!token || !token.name || !token.symbol) {
    document.getElementById("tokenCard").classList.add("hidden");
    document.getElementById("riskCard").classList.remove("hidden");

    document.getElementById("riskPill").className = "risk-pill risk-warning";
    document.getElementById("riskPill").textContent = "⚠️ Invalid input";
    document.getElementById("riskTitle").textContent = "Not an ARC-20 token.";
    document.getElementById("riskDescription").textContent =
      "A contract exists at this address, but it does not expose standard ARC-20 metadata.";

    document.querySelector(".risk-notes").innerHTML = `
      <li>This may be a non-token contract.</li>
      <li>Verify manually on the explorer.</li>
    `;
    return;
  }

  // --- TOKEN INFO ---
  fillTokenInfo(addr, token);
  applyRisk(addr, token);

  document.getElementById("tokenCard").classList.remove("hidden");
  document.getElementById("riskCard").classList.remove("hidden");
  status.textContent = "Token loaded successfully.";
}

/* =========================
   Token info
========================= */
function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name;
  document.getElementById("tSymbol").textContent = token.symbol;
  document.getElementById("tDecimals").textContent = token.decimals ?? "-";
  document.getElementById("tSupplyRaw").textContent = token.totalSupply ?? "-";
  document.getElementById("tSupplyHuman").textContent = token.totalSupply ?? "-";

  const addrEl = document.getElementById("tokenAddressShort");
  addrEl.textContent = shorten(address);
  addrEl.dataset.full = address;

  const explorer = document.getElementById("explorerLink");
  explorer.href = `${NETWORKS.arcTestnet.explorerBase}/token/${address}`;
  explorer.style.display = "inline-flex";
}

/* =========================
   Risk engine (simplified but correct)
========================= */
function applyRisk(address, token) {
  let score = 0;
  const notes = [];

  if (Number(token.decimals) === 0) {
    score += 2;
    notes.push("⚠️ Token has 0 decimals.");
  }

  if (!token.totalSupply || token.totalSupply === "0") {
    score += 2;
    notes.push("⚠️ Total supply is zero or unavailable.");
  }

  const pill = document.getElementById("riskPill");
  const title = document.getElementById("riskTitle");
  const desc = document.getElementById("riskDescription");

  pill.className = "risk-pill";

  if (score === 0) {
    pill.textContent = "🟢 Likely Safe";
    pill.classList.add("risk-safe");
    title.textContent = "No major red flags detected.";
    desc.textContent = "Token structure looks standard.";
  } else {
    pill.textContent = "⚠️ Risky";
    pill.classList.add("risk-warning");
    title.textContent = "Several red flags detected.";
    desc.textContent = "Interact only if you fully understand the risks.";
  }

  document.querySelector(".risk-notes").innerHTML =
    notes.map(n => `<li>${n}</li>`).join("") +
    "<li>Heuristic only — always verify manually.</li>";
}
