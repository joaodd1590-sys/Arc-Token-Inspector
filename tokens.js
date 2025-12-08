// =======================================================
//  Arc Token Inspector – LIVE VERSION (ArcScan API)
//  Fully Fixed for new API format
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
const copyAnalyzeAddressBtn = document.getElementById("copyAnalyzeAddress");

const toastEl = document.getElementById("toast");

let currentFilter = "all";
let LIVE_TOKENS = [];

// =======================================================
//  FETCH TOKEN INFO (SINGLE TOKEN)
// =======================================================

async function fetchTokenInfo(address) {
  const base = "https://testnet.arcscan.app/api";

  try {
    const metaRes = await fetch(
      `${base}?module=token&action=getToken&contractaddress=${address}`
    );
    const metaJson = await metaRes.json();

    if (!metaJson?.result) return null;

    const token = metaJson.result;

    // API nova NÃO fornece holders → "Unknown"
    const holders = token.holders ?? "Unknown";

    // Risco simplificado (não existe mais "verified")
    const risk = classifyRiskSimple(holders);

    return {
      name: token.name || "Unknown",
      symbol: token.symbol || "???",
      address: token.contractAddress || address,
      holders,
      decimals: token.decimals ?? "?",
      totalSupply: token.totalSupply ?? "?",
      status: risk.status,
      notes: risk.notes
    };
  } catch (err) {
    console.error("ERROR fetchTokenInfo:", err);
    return null;
  }
}

// =======================================================
//  FETCH ALL TOKENS (LISTA REAL)
// =======================================================

async function fetchTokenList() {
  const base = "https://testnet.arcscan.app/api";

  try {
    const res = await fetch(`${base}?module=token&action=tokenlist`);
    const json = await res.json();

    if (!json?.result || !Array.isArray(json.result)) return [];

    return json.result.map((t) => {
      const holders = t.holders ?? "Unknown";
      const risk = classifyRiskSimple(holders);

      return {
        name: t.name || "Unknown",
        symbol: t.symbol || "???",
        address: t.contractAddress,
        holders,
        decimals: t.decimals ?? "?",
        totalSupply: t.totalSupply ?? "?",
        status: risk.status,
        notes: risk.notes
      };
    });
  } catch (err) {
    console.error("ERROR fetchTokenList:", err);
    return [];
  }
}

// =======================================================
//  SIMPLE RISK ENGINE (NO VERIFIED FIELD)
// =======================================================

function classifyRiskSimple(holders) {
  const h = Number(holders);

  if (h > 50) {
    return {
      status: "trusted",
      notes: "Healthy number of holders."
    };
  }

  if (h > 0 && h <= 3) {
    return {
      status: "risky",
      notes: "Very few holders — high rug risk."
    };
  }

  return {
    status: "unknown",
    notes: "Unverified token — review before interacting."
  };
}

// =======================================================
//  ANALYSIS RESULT CARD
// =======================================================

function showAnalyzeResult(token) {
  analyzeHint.classList.add("hidden");
  analyzeResultCard.classList.remove("hidden");

  analyzeNameEl.textContent = `${token.name} (${token.symbol})`;

  analyzeStatusEl.className = "status-pill";
  if (token.status === "trusted") {
    analyzeStatusEl.classList.add("status-trusted");
    analyzeStatusEl.textContent = "Trusted";
  } else if (token.status === "risky") {
    analyzeStatusEl.classList.add("status-risky");
    analyzeStatusEl.textContent = "Risky";
  } else {
    analyzeStatusEl.classList.add("status-unknown");
    analyzeStatusEl.textContent = "Unknown";
  }

  analyzeAddressEl.textContent = token.address;
  analyzeHoldersEl.textContent = token.holders;
  analyzeNotesEl.textContent = token.notes;
}

// =======================================================
//  FORM SUBMIT – ANALYZE TOKEN BY ADDRESS
// =======================================================

analyzeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const value = addressInput.value.trim();

  if (!value.startsWith("0x") || value.length < 20) {
    showToast("Please enter a valid contract address.");
    return;
  }

  showToast("Fetching data...");

  const token = await fetchTokenInfo(value);

  if (!token) {
    showToast("Token not found.");
    return;
  }

  showAnalyzeResult(token);
  smoothScrollTo(analyzeResultCard);
});

// =======================================================
//  TABLE RENDERING – REAL DATA
// =======================================================

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function createStatusPill(status) {
  const span = document.createElement("span");
  span.classList.add("status-pill");

  if (status === "trusted") {
    span.classList.add("status-trusted");
    span.textContent = "Trusted";
  } else if (status === "risky") {
    span.classList.add("status-risky");
    span.textContent = "Risky";
  } else {
    span.classList.add("status-unknown");
    span.textContent = "Unknown";
  }

  return span;
}

function renderTable() {
  tableBody.innerHTML = "";

  const filtered = LIVE_TOKENS.filter((t) =>
    currentFilter === "all" ? true : t.status === currentFilter
  );

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "No tokens match this filter.";
    td.style.color = "var(--text-muted)";
    td.style.padding = "14px 10px";
    tr.appendChild(td);
    tableBody.appendChild(tr);
    return;
  }

  filtered.forEach((token) => {
    const tr = document.createElement("tr");

    // Token name + symbol
    const tdToken = document.createElement("td");
    tdToken.innerHTML = `
      <span class="token-name">${token.name}</span>
      <span class="token-symbol">${token.symbol}</span>
    `;

    // Address
    const tdAddress = document.createElement("td");
    tdAddress.innerHTML = `<span class="token-address">${shortAddr(token.address)}</span>`;

    // Holders
    const tdHolders = document.createElement("td");
    tdHolders.textContent = token.holders;

    // Status
    const tdStatus = document.createElement("td");
    tdStatus.appendChild(createStatusPill(token.status));

    // Actions
    const tdActions = document.createElement("td");
    tdActions.className = "col-actions";

    const viewBtn = document.createElement("button");
    viewBtn.className = "btn-ghost";
    viewBtn.textContent = "View";
    viewBtn.onclick = () => {
      showAnalyzeResult(token);
      smoothScrollTo(analyzeResultCard);
    };

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn-ghost btn-copy";
    copyBtn.textContent = "Copy";
    copyBtn.onclick = () => copyToClipboard(token.address, "Address copied");

    tdActions.appendChild(viewBtn);
    tdActions.appendChild(copyBtn);

    tr.appendChild(tdToken);
    tr.appendChild(tdAddress);
    tr.appendChild(tdHolders);
    tr.appendChild(tdStatus);
    tr.appendChild(tdActions);

    tableBody.appendChild(tr);
  });
}

// =======================================================
//  FILTER BUTTONS
// =======================================================

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    currentFilter = btn.dataset.filter;
    renderTable();
  });
});

// =======================================================
//  UTILITIES
// =======================================================

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 2000);
}

function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text).then(
    () => showToast(msg),
    () => showToast("Failed to copy")
  );
}

function smoothScrollTo(elem) {
  const rect = elem.getBoundingClientRect();
  const absoluteTop = window.scrollY + rect.top - 80;
  window.scrollTo({ top: absoluteTop, behavior: "smooth" });
}

// =======================================================
//  INIT – LOAD REAL TOKEN LIST
// =======================================================

(async function init() {
  showToast("Loading tokens...");
  LIVE_TOKENS = await fetchTokenList();
  renderTable();
})();
