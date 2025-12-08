// =======================================================
//  Arc Token Inspector – LIVE VERSION (ArcScan API)
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

// =======================================================
//  ARCSCAN LIVE TOKEN LOOKUP
// =======================================================

async function fetchTokenInfo(address) {
  const base = "https://testnet.arcscan.app/api";

  try {
    // 1) Fetch token metadata
    const metaRes = await fetch(
      `${base}?module=token&action=getToken&contractaddress=${address}`
    );
    const metaJson = await metaRes.json();

    if (!metaJson?.result) return null;

    const token = metaJson.result;

    // 2) Fetch holders count
    const holdersRes = await fetch(
      `${base}?module=token&action=getTokenHolders&contractaddress=${address}`
    );
    const holdersJson = await holdersRes.json();

    let holders = "?";
    if (holdersJson?.result?.holders) {
      holders = holdersJson.result.holders;
    }

    const risk = classifyRisk(token, holders);

    return {
      name: token.name || "Unknown",
      symbol: token.symbol || "???",
      address: address,
      holders: holders,
      decimals: token.decimals ?? "?",
      totalSupply: token.totalSupply ?? "?",
      verified: token.verified === "true",
      status: risk.status,
      notes: risk.notes
    };
  } catch (err) {
    console.error("ERROR fetching token:", err);
    return null;
  }
}

// =======================================================
//  RISK ANALYSIS
// =======================================================

function classifyRisk(token, holders) {
  // RULE 1: Verified contract + good holder count → trusted
  if (token.verified === "true" && holders > 50) {
    return {
      status: "trusted",
      notes: "Verified contract with healthy number of holders."
    };
  }

  // RULE 2: Very low holders → risky
  if (Number(holders) <= 3) {
    return {
      status: "risky",
      notes: "Very few holders — high rug risk. DYOR."
    };
  }

  // RULE 3: Unverified → unknown
  if (token.verified !== "true") {
    return {
      status: "unknown",
      notes: "Unverified contract — review before interacting."
    };
  }

  return {
    status: "unknown",
    notes: "Insufficient data — proceed with caution."
  };
}

// =======================================================
//  Analyze result renderer
// =======================================================

function showAnalyzeResult(tokenLike) {
  analyzeHint.classList.add("hidden");
  analyzeResultCard.classList.remove("hidden");

  analyzeNameEl.textContent = `${tokenLike.name} (${tokenLike.symbol})`;

  // Reset pill
  analyzeStatusEl.className = "status-pill";
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

// =======================================================
//  Form submission (real API mode)
// =======================================================

analyzeForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const value = addressInput.value.trim();

  if (!value || !value.startsWith("0x") || value.length < 20) {
    showToast("Please enter a valid contract address.");
    return;
  }

  showToast("Fetching data...");

  const token = await fetchTokenInfo(value);

  if (token) {
    showAnalyzeResult(token);
  } else {
    showToast("Token not found on ArcScan.");
  }

  smoothScrollTo(analyzeResultCard);
});

// =======================================================
//  COPY BUTTON
// =======================================================

copyAnalyzeAddressBtn.addEventListener("click", () => {
  const addr = analyzeAddressEl.textContent.trim();
  if (!addr) return;
  copyToClipboard(addr, "Address copied");
});

// =======================================================
//  TABLE (EMPTY FOR NOW — LIVE MODE DOESN'T USE STATIC LIST)
// =======================================================

function renderTable() {
  tableBody.innerHTML = "";

  const trEmpty = document.createElement("tr");
  const tdEmpty = document.createElement("td");
  tdEmpty.colSpan = 5;
  tdEmpty.textContent = "Token list disabled (using live API mode).";
  tdEmpty.style.color = "var(--text-muted)";
  tdEmpty.style.padding = "14px 10px";
  trEmpty.appendChild(tdEmpty);

  tableBody.appendChild(trEmpty);
}

// =======================================================
//  FILTER BUTTONS (STILL WORK, JUST DISABLED LIST)
// =======================================================

filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
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
