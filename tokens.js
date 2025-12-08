// =======================================================
//  Arc Token Inspector – Frontend Logic
// =======================================================

// Mock token list for Arc Testnet.
// In the future you can swap this for live data from ArcScan / Blockscout.
const TOKENS = [
  {
    id: "usdc-test",
    name: "USD Coin (Test)",
    symbol: "USDC",
    address: "0xMockUSDC00000000000000000000000000000001",
    holders: 420,
    status: "trusted",
    notes: "Circle-style test USDC on Arc Testnet. Used for most gas & fee examples."
  },
  {
    id: "memearc",
    name: "MemeArc",
    symbol: "MARC",
    address: "0xMockMARC0000000000000000000000000000002",
    holders: 7,
    status: "unknown",
    notes:
      "Low holder count and short history. Could be harmless, could be a rug – do your own research."
  },
  {
    id: "superyield",
    name: "SuperYield 1000x",
    symbol: "SYLD",
    address: "0xMockSYLD0000000000000000000000000000003",
    holders: 1,
    status: "risky",
    notes:
      "Contract not verified and contains functions that may allow draining or freezing balances."
  }
];

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

// =======================================================
//  Rendering
// =======================================================
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

  const tokens = TOKENS.filter((t) =>
    currentFilter === "all" ? true : t.status === currentFilter
  );

  tokens.forEach((token) => {
    const tr = document.createElement("tr");

    // Token col
    const tdToken = document.createElement("td");
    const nameSpan = document.createElement("span");
    nameSpan.className = "token-name";
    nameSpan.textContent = token.name;

    const symbolSpan = document.createElement("span");
    symbolSpan.className = "token-symbol";
    symbolSpan.textContent = token.symbol;

    tdToken.appendChild(nameSpan);
    tdToken.appendChild(symbolSpan);

    // Address col
    const tdAddress = document.createElement("td");
    const addrSpan = document.createElement("span");
    addrSpan.className = "token-address";
    addrSpan.textContent = shortAddr(token.address);
    tdAddress.appendChild(addrSpan);

    // Holders col
    const tdHolders = document.createElement("td");
    tdHolders.textContent = token.holders.toString();

    // Status col
    const tdStatus = document.createElement("td");
    tdStatus.appendChild(createStatusPill(token.status));

    // Actions col
    const tdActions = document.createElement("td");
    tdActions.className = "col-actions";

    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "btn-ghost";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", () => {
      showAnalyzeResult(token);
      smoothScrollTo(analyzeResultCard);
    });

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn-ghost btn-copy";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      copyToClipboard(token.address, "Token address copied");
    });

    tdActions.appendChild(viewBtn);
    tdActions.appendChild(copyBtn);

    tr.appendChild(tdToken);
    tr.appendChild(tdAddress);
    tr.appendChild(tdHolders);
    tr.appendChild(tdStatus);
    tr.appendChild(tdActions);

    tableBody.appendChild(tr);
  });

  if (tokens.length === 0) {
    const trEmpty = document.createElement("tr");
    const tdEmpty = document.createElement("td");
    tdEmpty.colSpan = 5;
    tdEmpty.textContent = "No tokens for this filter.";
    tdEmpty.style.color = "var(--text-muted)";
    tdEmpty.style.padding = "14px 10px";
    trEmpty.appendChild(tdEmpty);
    tableBody.appendChild(trEmpty);
  }
}

// helper for shortening addresses
function shortAddr(addr) {
  if (!addr || addr.length < 10) return addr || "--";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// =======================================================
//  Analyze by address
// =======================================================

function findTokenByAddress(address) {
  if (!address) return null;
  const normalized = address.trim().toLowerCase();
  return TOKENS.find((t) => t.address.toLowerCase() === normalized) || null;
}

// Basic mock classification for addresses not in TOKENS
function classifyUnknownAddress(address) {
  // very naive heuristics for the demo:
  // if address ends with many zeros -> risky (could be proxy or weird)
  const lastFour = address.slice(-4);
  let status = "unknown";
  let holders = "?";
  let notes =
    "This contract is not in the curated list. No risk data is available – treat as unknown.";

  if (/^0{3,4}$/g.test(lastFour)) {
    status = "risky";
    notes =
      "The address pattern looks unusual and this contract is not in the curated list. Treat as risky.";
  }

  return { status, holders, notes };
}

function showAnalyzeResult(tokenLike) {
  analyzeHint.classList.add("hidden");
  analyzeResultCard.classList.remove("hidden");

  analyzeNameEl.textContent = `${tokenLike.name} (${tokenLike.symbol})`;
  analyzeStatusEl.className = "status-pill"; // reset classes
  if (tokenLike.status === "trusted") {
    analyzeStatusEl.classList.add("status-trusted");
    analyzeStatusEl.textContent = "Trusted";
  } else if (tokenLike.status === "risky") {
    analyzeStatusEl.classList.add("status-risky");
    analyzeStatusEl.textContent = "Risky";
  } else {
    analyzeStatusEl.classList.add("status-unknown");
    analyzeStatusEl.textContent = "Unknown";
  }

  analyzeAddressEl.textContent = tokenLike.address;
  analyzeHoldersEl.textContent = tokenLike.holders ?? "Unknown";
  analyzeNotesEl.textContent = tokenLike.notes || "No additional notes.";
}

analyzeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = addressInput.value.trim();

  if (!value || !value.startsWith("0x") || value.length < 20) {
    showToast("Please enter a valid token contract address (0x...)");
    return;
  }

  const known = findTokenByAddress(value);
  if (known) {
    showAnalyzeResult(known);
  } else {
    const { status, holders, notes } = classifyUnknownAddress(value);
    const pseudoToken = {
      name: "Unknown token",
      symbol: "???",
      address: value,
      holders,
      status,
      notes
    };
    showAnalyzeResult(pseudoToken);
  }

  smoothScrollTo(analyzeResultCard);
});

// Copy from result card
copyAnalyzeAddressBtn.addEventListener("click", () => {
  const addr = analyzeAddressEl.textContent.trim();
  if (!addr) return;
  copyToClipboard(addr, "Address copied");
});

// =======================================================
//  Filters
// =======================================================
filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const filter = btn.getAttribute("data-filter");
    currentFilter = filter;

    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    renderTable();
  });
});

// =======================================================
//  Utils – toast, scroll, clipboard
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
  navigator.clipboard
    .writeText(text)
    .then(() => showToast(msg || "Copied"))
    .catch(() => showToast("Failed to copy"));
}

function smoothScrollTo(elem) {
  if (!elem) return;
  const rect = elem.getBoundingClientRect();
  const absoluteTop = window.scrollY + rect.top - 80;
  window.scrollTo({ top: absoluteTop, behavior: "smooth" });
}

// =======================================================
//  Init
// =======================================================
renderTable();
