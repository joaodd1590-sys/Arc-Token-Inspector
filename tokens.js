// =======================================================
// ARC TOKEN INSPECTOR – REAL FINAL VERSION (API VALIDATED)
// =======================================================

// DOM refs
const tableBody = document.getElementById("tokenTableBody");
const filterButtons = document.querySelectorAll(".filter-btn");

const analyzeForm = document.getElementById("analyzeForm");
const addressInput = document.getElementById("tokenAddress");
const analyzeResultCard = document.getElementById("analyzeResult");
const analyzeNameEl = document.getElementById("analyzeName");
const analyzeStatusEl = document.getElementById("analyzeStatus");
const analyzeAddressEl = document.getElementById("analyzeAddress");
const analyzeHoldersEl = document.getElementById("analyzeHolders");
const analyzeNotesEl = document.getElementById("analyzeNotes");
const analyzeHint = document.getElementById("analyzeEmptyHint");

const toastEl = document.getElementById("toast");

let LIVE_TOKENS = [];
let currentFilter = "all";

// =======================================================
//  RISK ENGINE
// =======================================================

function classifyRisk(holders) {
  const h = Number(holders);
  if (h > 50) return { status: "trusted", notes: "Healthy number of holders." };
  if (h <= 3) return { status: "risky", notes: "Very low holder count." };
  return { status: "unknown", notes: "Unverified token — proceed with caution." };
}

// =======================================================
// FETCH TOKEN INFO (REAL API PATHS)
// =======================================================

async function fetchTokenInfo(address) {
  const base = "https://testnet.arcscan.app/api";

  let name = "Unknown";
  let symbol = "???";
  let decimals = "?";
  let totalSupply = "?";
  let holders = "Unknown";

  // STEP 1 — GET NAME + SYMBOL (API v1)
  try {
    const r1 = await fetch(`${base}?module=token&action=getToken&contractaddress=${address}`);
    const j1 = await r1.json();

    if (j1?.result) {
      name = j1.result.name ?? name;
      symbol = j1.result.symbol ?? symbol;
      decimals = j1.result.decimals ?? decimals;
      totalSupply = j1.result.totalSupply ?? totalSupply;
    }
  } catch (err) {}

  // STEP 2 — GET HOLDERS (API v2 VALID!)
  try {
    const r2 = await fetch(`https://testnet.arcscan.app/api/v2/tokens/${address}/holders`);
    const j2 = await r2.json();

    if (j2?.count !== undefined) {
      holders = j2.count;
    }
  } catch (err) {}

  const risk = classifyRisk(holders);

  return {
    name,
    symbol,
    address,
    decimals,
    totalSupply,
    holders,
    status: risk.status,
    notes: risk.notes,
  };
}

// =======================================================
// FETCH TOKEN LIST (REAL ENDPOINT)
// =======================================================

async function fetchTokenList() {
  try {
    const res = await fetch("https://testnet.arcscan.app/api/v2/tokens");
    const json = await res.json();

    if (!json.items) return [];

    return json.items.map((t) => {
      const risk = classifyRisk(t.holders ?? "Unknown");
      return {
        name: t.name,
        symbol: t.symbol,
        address: t.address,
        holders: t.holders,
        status: risk.status,
        notes: risk.notes,
      };
    });
  } catch (err) {
    console.log("Error loading list");
    return [];
  }
}

// =======================================================
// PANEL RENDER
// =======================================================

function showAnalyzeResult(t) {
  analyzeHint.classList.add("hidden");
  analyzeResultCard.classList.remove("hidden");

  analyzeNameEl.textContent = `${t.name} (${t.symbol})`;

  analyzeStatusEl.className = "status-pill";
  analyzeStatusEl.classList.add(
    t.status === "trusted" ? "status-trusted" :
    t.status === "risky" ? "status-risky" :
    "status-unknown"
  );
  analyzeStatusEl.textContent = t.status;

  analyzeAddressEl.textContent = t.address;
  analyzeHoldersEl.textContent = t.holders;
  analyzeNotesEl.textContent = t.notes;
}

// =======================================================
// FORM SUBMIT
// =======================================================

analyzeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const addr = addressInput.value.trim();

  if (!addr.startsWith("0x") || addr.length !== 42) {
    showToast("Invalid address.");
    return;
  }

  showToast("Fetching...");
  const data = await fetchTokenInfo(addr);
  showAnalyzeResult(data);
});

// =======================================================
// TABLE RENDER
// =======================================================

function renderTable() {
  tableBody.innerHTML = "";

  const filtered = LIVE_TOKENS.filter((t) =>
    currentFilter === "all" ? true : t.status === currentFilter
  );

  filtered.forEach((t) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><span>${t.name}</span> <small>${t.symbol}</small></td>
      <td>${t.address}</td>
      <td>${t.holders}</td>
      <td>${t.status}</td>
      <td>
        <button class="btn-ghost" onclick="showAnalyzeResult(${JSON.stringify(t)})">View</button>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

// =======================================================
// INIT
// =======================================================

(async function init() {
  showToast("Loading tokens...");
  LIVE_TOKENS = await fetchTokenList();
  renderTable();
})();
