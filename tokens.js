// =======================================================
//  ARC TOKEN INSPECTOR – FINAL FIXED VERSION (API v1 + v2)
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
//  RISK ENGINE
// =======================================================

function classifyRiskSimple(holders) {
  const h = Number(holders);

  if (h > 50) {
    return { status: "trusted", notes: "Healthy number of holders." };
  }

  if (h > 0 && h <= 3) {
    return { status: "risky", notes: "Very few holders — high rug risk." };
  }

  return { status: "unknown", notes: "Unverified token — review before interacting." };
}

// =======================================================
//  FETCH TOKEN INFO – INDIVIDUAL ANALYSIS
//  Uses API v1 (getToken) + API v2 (search)
// =======================================================

async function fetchTokenInfo(address) {
  const baseV1 = "https://testnet.arcscan.app/api";
  const baseV2 = "https://testnet.arcscan.app/api/v2/tokens?search=";

  let name = "Unknown";
  let symbol = "???";
  let decimals = "?";
  let totalSupply = "?";
  let holders = "Unknown";

  // STEP 1 — API v1 (name + symbol + decimals)
  try {
    const r1 = await fetch(
      `${baseV1}?module=token&action=getToken&contractaddress=${address}`
    );
    const j1 = await r1.json();

    if (j1?.result) {
      if (j1.result.name) name = j1.result.name;
      if (j1.result.symbol) symbol = j1.result.symbol;
      if (j1.result.decimals) decimals = j1.result.decimals;
      if (j1.result.totalSupply) totalSupply = j1.result.totalSupply;
    }
  } catch (err) {
    console.log("API v1 failed");
  }

  // STEP 2 — API v2 search (holders + address + decimals + supply)
  try {
    const r2 = await fetch(`${baseV2}${address}`);
    const j2 = await r2.json();

    if (j2?.items?.length > 0) {
      const t = j2.items[0];

      if (t.address) address = t.address;
      if (t.name) name = t.name;
      if (t.symbol) symbol = t.symbol;
      if (t.decimals !== undefined) decimals = t.decimals;
      if (t.total_supply !== undefined) totalSupply = t.total_supply;
      if (t.holders !== undefined) holders = t.holders;
    }
  } catch (err) {
    console.log("API v2 search failed");
  }

  const risk = classifyRiskSimple(holders);

  return {
    name,
    symbol,
    address,
    holders,
    decimals,
    totalSupply,
    status: risk.status,
    notes: risk.notes,
  };
}

// =======================================================
//  FETCH TOKEN LIST (API v2 pagination)
// =======================================================

async function fetchTokenList() {
  const base = "https://testnet.arcscan.app/api/v2/tokens";
  let all = [];
  let next = null;

  try {
    while (true) {
      const url = next ? `${base}?${next}` : base;

      const res = await fetch(url);
      const json = await res.json();

      if (!json?.items) break;

      json.items.forEach((t) => {
        const risk = classifyRiskSimple(t.holders ?? "Unknown");

        all.push({
          name: t.name || "Unknown",
          symbol: t.symbol || "???",
          address: t.address,
          holders: t.holders ?? "Unknown",
          decimals: t.decimals,
          totalSupply: t.total_supply,
          status: risk.status,
          notes: risk.notes,
        });
      });

      if (!json.next_page_params) break;

      next = new URLSearchParams(json.next_page_params).toString();
    }
  } catch (err) {
    console.error("Error loading token list", err);
  }

  return all;
}

// =======================================================
//  RENDER ANALYSIS PANEL
// =======================================================

function showAnalyzeResult(token) {
  analyzeHint.classList.add("hidden");
  analyzeResultCard.classList.remove("hidden");

  analyzeNameEl.textContent = `${token.name} (${token.symbol})`;

  analyzeStatusEl.className = "status-pill";
  analyzeStatusEl.classList.add(
    token.status === "trusted"
      ? "status-trusted"
      : token.status === "risky"
      ? "status-risky"
      : "status-unknown"
  );
  analyzeStatusEl.textContent =
    token.status.charAt(0).toUpperCase() + token.status.slice(1);

  analyzeAddressEl.textContent = token.address;
  analyzeHoldersEl.textContent = token.holders;
  analyzeNotesEl.textContent = token.notes;
}

// =======================================================
//  SUBMIT ANALYSIS FORM
// =======================================================

analyzeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const addr = addressInput.value.trim();

  if (!addr.startsWith("0x") || addr.length < 20) {
    showToast("Please enter a valid contract address.");
    return;
  }

  showToast("Fetching data...");

  const token = await fetchTokenInfo(addr);

  if (!token) {
    showToast("Token not found.");
    return;
  }

  showAnalyzeResult(token);
  smoothScrollTo(analyzeResultCard);
});

// =======================================================
//  TABLE RENDERING
// =======================================================

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function createStatusPill(status) {
  const pill = document.createElement("span");
  pill.classList.add("status-pill");

  pill.classList.add(
    status === "trusted"
      ? "status-trusted"
      : status === "risky"
      ? "status-risky"
      : "status-unknown"
  );

  pill.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  return pill;
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
    td.style.padding = "14px";
    tr.appendChild(td);
    tableBody.appendChild(tr);
    return;
  }

  filtered.forEach((token) => {
    const tr = document.createElement("tr");

    const tdToken = document.createElement("td");
    tdToken.innerHTML = `
      <span class="token-name">${token.name}</span>
      <span class="token-symbol">${token.symbol}</span>
    `;

    const tdAddress = document.createElement("td");
    tdAddress.innerHTML = `<span class="token-address">${shortAddr(token.address)}</span>`;

    const tdHolders = document.createElement("td");
    tdHolders.textContent = token.holders;

    const tdStatus = document.createElement("td");
    tdStatus.appendChild(createStatusPill(token.status));

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
    copyBtn.onclick = () =>
      copyToClipboard(token.address, "Address copied");

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
  showToast._timer = setTimeout(() => toastEl.classList.add("hidden"), 2000);
}

function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text).then(
    () => showToast(msg),
    () => showToast("Failed to copy")
  );
}

function smoothScrollTo(elem) {
  const rect = elem.getBoundingClientRect();
  window.scrollTo({ top: window.scrollY + rect.top - 80, behavior: "smooth" });
}

// =======================================================
//  INIT – LOAD ALL TOKENS
// =======================================================

(async function init() {
  showToast("Loading tokens...");
  LIVE_TOKENS = await fetchTokenList();
  renderTable();
})();
