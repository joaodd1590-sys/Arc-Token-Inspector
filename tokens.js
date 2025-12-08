// =======================================================
//  Arc Token Inspector – Real Analyze (Solution A)
// =======================================================

// Mock table tokens
const TOKENS = [
  {
    id: "usdc-test",
    name: "USD Coin (Test)",
    symbol: "USDC",
    address: "0xMockUSDC00000000000000000000000000000001",
    holders: 420,
    status: "trusted",
    notes: "Circle-style test USDC on Arc Testnet."
  },
  {
    id: "memearc",
    name: "MemeArc",
    symbol: "MARC",
    address: "0xMockMARC0000000000000000000000000000002",
    holders: 7,
    status: "unknown",
    notes: "Low holder count and short history."
  },
  {
    id: "superyield",
    name: "SuperYield 1000x",
    symbol: "SYLD",
    address: "0xMockSYLD0000000000000000000000000000003",
    holders: 1,
    status: "risky",
    notes: "Contract includes suspicious functions."
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
// RISK ENGINE
// =======================================================

function classifyRiskSimple(h) {
  const holders = Number(h);

  if (holders > 50)
    return { status: "trusted", notes: "Healthy number of holders." };

  if (holders > 0 && holders <= 3)
    return { status: "risky", notes: "Very low holder count." };

  return { status: "unknown", notes: "Unverified token — proceed with caution." };
}

// =======================================================
// FETCH REAL TOKEN DATA (API v1 + API v2 COMBINED)
// =======================================================

async function fetchRealToken(address) {
  let name = "Unknown";
  let symbol = "???";
  let decimals = "?";
  let totalSupply = "?";
  let holders = "Unknown";

  // STEP 1 — API v1 (basic info)
  try {
    const r1 = await fetch(
      `https://testnet.arcscan.app/api?module=token&action=getToken&contractaddress=${address}`
    );
    const j1 = await r1.json();

    if (j1?.result) {
      name = j1.result.name ?? name;
      symbol = j1.result.symbol ?? symbol;
      decimals = j1.result.decimals ?? decimals;
      totalSupply = j1.result.totalSupply ?? totalSupply;
    }
  } catch (err) {
    console.log("API v1 error:", err);
  }

  // STEP 2 — API v2 (holders)
  try {
    const r2 = await fetch(
      `https://testnet.arcscan.app/api/v2/tokens/${address}/holders?items_count=10000`
    );
    const j2 = await r2.json();

    if (j2?.count !== undefined) {
      holders = j2.count;
    }
  } catch (err) {
    console.log("API v2 error:", err);
  }

  const risk = classifyRiskSimple(holders);

  return {
    name,
    symbol,
    address,
    decimals,
    totalSupply,
    holders,
    status: risk.status,
    notes: risk.notes
  };
}

// =======================================================
// HELPERS
// =======================================================

function findTokenByAddress(address) {
  return TOKENS.find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  ) || null;
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// =======================================================
// RENDER ANALYSIS PANEL
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
  analyzeStatusEl.textContent = token.status;

  analyzeAddressEl.textContent = token.address;
  analyzeHoldersEl.textContent = token.holders;
  analyzeNotesEl.textContent = token.notes;
}

// =======================================================
// ANALYZE FORM HANDLER
// =======================================================

analyzeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const address = addressInput.value.trim();

  if (!address.startsWith("0x") || address.length < 20) {
    showToast("Please enter a valid token contract address.");
    return;
  }

  showToast("Fetching token...");

  const mockToken = findTokenByAddress(address);
  if (mockToken) {
    showAnalyzeResult(mockToken);
    smoothScrollTo(analyzeResultCard);
    return;
  }

  const realToken = await fetchRealToken(address);
  showAnalyzeResult(realToken);
  smoothScrollTo(analyzeResultCard);
});

// Copy button
copyAnalyzeAddressBtn.addEventListener("click", () => {
  copyToClipboard(analyzeAddressEl.textContent, "Address copied");
});

// =======================================================
// TABLE RENDERING (MOCK)
// =======================================================

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

  pill.textContent = status;
  return pill;
}

function renderTable() {
  tableBody.innerHTML = "";

  const tokens = TOKENS.filter((t) =>
    currentFilter === "all" ? true : t.status === currentFilter
  );

  tokens.forEach((token) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><span class="token-name">${token.name}</span><span class="token-symbol">${token.symbol}</span></td>
      <td>${shortAddr(token.address)}</td>
      <td>${token.holders}</td>
      <td></td>
      <td class="col-actions"></td>
    `;

    const tdStatus = tr.children[3];
    tdStatus.appendChild(createStatusPill(token.status));

    const tdActions = tr.children[4];

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

    tableBody.appendChild(tr);
  });
}

// Filters
filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    currentFilter = btn.dataset.filter;
    renderTable();
  });
});

// =======================================================
// UTILITIES
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
  window.scrollTo({
    top: window.scrollY + rect.top - 80,
    behavior: "smooth"
  });
}

// =======================================================
// INIT
// =======================================================

renderTable();
