// tokens.js
// Arc Token Inspector - Explorer + Risk Analyzer (no wallet connection)

const API_BASE = "https://testnet.arcscan.app";

const searchInput = document.getElementById("tokenSearch");
const analyzeBtn = document.getElementById("analyzeBtn");
const searchError = document.getElementById("searchError");
const searchResult = document.getElementById("searchResult");

const tokensLoading = document.getElementById("tokensLoading");
const tokensTable = document.getElementById("tokensTable");
const tokensTbody = document.getElementById("tokensTbody");
const filterChips = document.querySelectorAll(".chip");

let ALL_TOKENS = [];

// Mock data for now
const MOCK_TOKENS = [
  {
    address: "0xMockUSDC00000000000000000000000000000001",
    name: "USD Coin (Test)",
    symbol: "USDC",
    holders: 420,
    totalSupply: "1000000",
    verified: true,
    daysOld: 40,
    suspiciousFunctions: []
  },
  {
    address: "0xMockMEME0000000000000000000000000000002",
    name: "MemeArc",
    symbol: "MARC",
    holders: 7,
    totalSupply: "1000000000",
    verified: false,
    daysOld: 3,
    suspiciousFunctions: []
  },
  {
    address: "0xMockSCAM000000000000000000000000000003",
    name: "SuperYield 1000x",
    symbol: "SYLD",
    holders: 1,
    totalSupply: "9999999999",
    verified: false,
    daysOld: 1,
    suspiciousFunctions: ["mint", "pause", "blacklist"]
  }
];

// Risk scoring
function computeRisk(token) {
  const reasons = [];
  let score = 0;

  if (token.verified) {
    score += 2;
    reasons.push("Contract is verified on ArcScan / Blockscout.");
  } else {
    score -= 2;
    reasons.push("Contract is not verified.");
  }

  if (token.holders != null) {
    if (token.holders >= 100) {
      score += 2;
      reasons.push("Healthy number of holders (100+).");
    } else if (token.holders === 0) {
      score -= 2;
      reasons.push("No holders registered.");
    } else {
      reasons.push("Token has very few holders.");
    }
  }

  if (token.daysOld != null) {
    if (token.daysOld >= 30) {
      score += 1;
      reasons.push("Token has been around for 30+ days.");
    } else if (token.daysOld <= 2) {
      score -= 1;
      reasons.push("Token is very new.");
    }
  }

  if (token.suspiciousFunctions?.length) {
    score -= 3;
    reasons.push(
      "Sensitive or high-risk functions detected: " +
        token.suspiciousFunctions.join(", ")
    );
  }

  let status = "unknown";
  if (score >= 3) status = "trusted";
  else if (score <= -1) status = "danger";

  return { status, reasons };
}

function statusBadge(status) {
  if (status === "trusted")
    return '<span class="badge status-trusted">Trusted</span>';
  if (status === "danger")
    return '<span class="badge status-danger">Not Safe</span>';
  return '<span class="badge status-unknown">Unknown</span>';
}

// API (placeholder until ArcScan endpoint is confirmed)
async function fetchTopTokens() {
  try {
    // TODO — replace with real ArcScan token endpoint
    return MOCK_TOKENS;
  } catch (err) {
    console.error("Error fetching tokens:", err);
    return MOCK_TOKENS;
  }
}

async function fetchTokenByAddress(address) {
  try {
    const mock = MOCK_TOKENS.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    );
    if (mock) return mock;

    throw new Error("Not found (mock).");
  } catch (err) {
    console.error("Error fetching token:", err);
    throw err;
  }
}

// Short address
function shortAddr(addr) {
  if (!addr) return "-";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// Render table
function renderTokensTable(tokens, filter = "all") {
  tokensTbody.innerHTML = "";

  const filtered = tokens.filter((t) => {
    const risk = computeRisk(t).status;
    if (filter === "all") return true;
    return risk === filter;
  });

  if (!filtered.length) {
    tokensTbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding:10px; color:var(--muted);">
          No tokens found for this filter.
        </td>
      </tr>
    `;
    return;
  }

  for (const token of filtered) {
    const { status } = computeRisk(token);
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <div>${token.name}</div>
        <div class="muted">${token.symbol}</div>
      </td>

      <td><span class="addr-small">${shortAddr(token.address)}</span></td>

      <td>${token.holders ?? "-"}</td>

      <td>${statusBadge(status)}</td>

      <td>
        <button class="btn ghost btn-sm" data-addr="${token.address}">View</button>
      </td>
    `;

    tr.querySelector("button").onclick = () => renderTokenCard(token);

    tokensTbody.appendChild(tr);
  }
}

// Render card
function renderTokenCard(token) {
  const { status, reasons } = computeRisk(token);

  searchResult.classList.remove("hidden");

  searchResult.innerHTML = `
    <div class="token-card-header">
      <div>
        <div class="token-name">${token.name}</div>
        <div class="token-addr">${token.address}</div>
      </div>
      <div>${statusBadge(status)}</div>
    </div>

    <div class="token-meta">
      <div><strong>Symbol:</strong> ${token.symbol}</div>
      <div><strong>Holders:</strong> ${token.holders}</div>
      <div><strong>Total Supply:</strong> ${token.totalSupply}</div>
      <div><strong>Age:</strong> ${
        token.daysOld != null ? token.daysOld + " days" : "-"
      }</div>

      <div style="margin-top:6px;">
        <strong>Reasons:</strong>
        <ul>
          ${reasons.map((r) => `<li>${r}</li>`).join("")}
        </ul>
      </div>

      <div style="margin-top:8px;">
        <a href="https://testnet.arcscan.app/token/${token.address}" target="_blank">
          View on ArcScan
        </a>
      </div>
    </div>
  `;
}

// Search button
analyzeBtn.onclick = async () => {
  const addr = searchInput.value.trim();

  searchError.classList.add("hidden");
  searchResult.classList.add("hidden");

  if (!addr || !addr.startsWith("0x") || addr.length < 20) {
    searchError.textContent = "Enter a valid token contract address (0x...).";
    searchError.classList.remove("hidden");
    return;
  }

  try {
    const token = await fetchTokenByAddress(addr);
    renderTokenCard(token);
  } catch {
    searchError.textContent =
      "Token not found. Try one of the tokens listed below.";
    searchError.classList.remove("hidden");
  }
};

// Filters
filterChips.forEach((chip) => {
  chip.onclick = () => {
    filterChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    renderTokensTable(ALL_TOKENS, chip.dataset.filter);
  };
});

// Initialize
(async function init() {
  tokensLoading.classList.remove("hidden");
  tokensTable.classList.add("hidden");

  ALL_TOKENS = await fetchTopTokens();

  tokensLoading.classList.add("hidden");
  tokensTable.classList.remove("hidden");

  renderTokensTable(ALL_TOKENS, "all");
})();
