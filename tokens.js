// =======================================================
//  Arc Token Inspector – Stable Version + Real Analyze
// =======================================================

// Mock token list for Arc Testnet (table only)
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
//  RISK ENGINE
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
//  FETCH REAL TOKEN DATA FROM ARCSCAN
//  (downloads full list once per analyze)
// =======================================================

async function fetchRealToken(address) {
  let name = "Unknown";
  let symbol = "???";
  let decimals = "?";
  let totalSupply = "?";
  let holders = "Unknown";

  try {
    // DOWNLOADING REAL TOKEN LIST FROM ARC
    const url = `https://testnet.arcscan.app/api/v2/tokens?type=ERC-20&items_count=500`;
    const res = await fetch(url);
    const json = await res.json();

    // FIND TOKEN BY ADDRESS
    if (json?.items?.length > 0) {
      const token = json.items.find(
        (t) => t.address.toLowerCase() === address.toLowerCase()
      );

      if (token) {
        name = token.name ?? name;
        symbol = token.symbol ?? symbol;
        decimals = token.decimals ?? decimals;
        totalSupply = token.total_supply ?? totalSupply;
        holders = token.holders ?? holders;
      }
    }
  } catch (err) {
    console.log("Error fetching ARCScan real token list:", err);
  }

  // Risk evaluation
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
//  HELPER FUNCTIONS
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
  analyzeStatusEl.textContent = token.status;

  analyzeAddressEl.textContent = token.address;
  analyzeHoldersEl.textContent = token.holders;
  analyzeNotesEl.textContent = token.notes;
}

// =======================================================
//  HANDLE ANALYZE BUTTON
// =======================================================

analyzeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const address = addressInput.value.trim();

  if (!address.startsWith("0x") || address.length < 20) {
    showToast("Please enter a valid token contract address.");
    return;
  }

  showToast("Fetching token...");

  // Try mock list
  const mockToken = findTokenByAddress(address);
  if (mockToken) {
    showAnalyzeResult(mockToken);
    smoothScrollTo(analyzeResultCard);
    return;
  }

  // Fetch REAL on-chain token
  const realToken = await fetchRealToken(address);
  showAnalyzeResult(realToken);
  smoothScrollTo(analyzeResultCard);
});

// Copy button
copyAnalyzeAddressBtn.addEventListener("click", () => {
  copyToClipboard(analyzeAddressEl.textContent, "Address copied");
});

// =======================================================
//  TABLE RENDERING (MOCK ONLY)
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
  window.scrollTo({
    top: window.scrollY + rect.top - 80,
    behavior: "smooth"
  });
}

// =======================================================
//  INIT
// =======================================================

renderTable();
