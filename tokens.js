// tokens.js
// Arc Token Inspector - Explorer + Risk Analyzer
// NÃO conecta carteira, só lê dados públicos do explorer.

const API_BASE = "https://testnet.arcscan.app"; // base do ArcScan

const searchInput = document.getElementById("tokenSearch");
const analyzeBtn = document.getElementById("analyzeBtn");
const searchError = document.getElementById("searchError");
const searchResult = document.getElementById("searchResult");

const tokensLoading = document.getElementById("tokensLoading");
const tokensTable = document.getElementById("tokensTable");
const tokensTbody = document.getElementById("tokensTbody");
const filterChips = document.querySelectorAll(".chip");

let ALL_TOKENS = [];

// ============ MOCK de tokens (usado se API falhar) ============
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

// ============ Função de risco ============
// Retorna: { status: 'trusted' | 'unknown' | 'danger', reasons: [] }
function computeRisk(token) {
  const reasons = [];
  let score = 0;

  // Baseado em alguns critérios simples
  if (token.verified) {
    score += 2;
    reasons.push("Contrato verificado no ArcScan/Blockscout.");
  } else {
    score -= 2;
    reasons.push("Contrato não verificado.");
  }

  if (token.holders != null) {
    if (token.holders >= 100) {
      score += 2;
      reasons.push("Número de holders razoável (100+).");
    } else if (token.holders === 0) {
      score -= 2;
      reasons.push("Nenhum holder registrado.");
    } else {
      reasons.push("Poucos holders; pode ser novo ou pouco usado.");
    }
  }

  if (token.daysOld != null) {
    if (token.daysOld >= 30) {
      score += 1;
      reasons.push("Token com algum tempo de vida (30+ dias).");
    } else if (token.daysOld <= 2) {
      score -= 1;
      reasons.push("Token muito recente.");
    }
  }

  if (Array.isArray(token.suspiciousFunctions) && token.suspiciousFunctions.length) {
    score -= 3;
    reasons.push(
      "Funções sensíveis detectadas no contrato: " +
        token.suspiciousFunctions.join(", ")
    );
  }

  let status = "unknown";
  if (score >= 3) status = "trusted";
  else if (score <= -1) status = "danger";

  return { status, reasons };
}

function statusBadge(status) {
  if (status === "trusted") {
    return '<span class="badge status-trusted">Confiável</span>';
  }
  if (status === "danger") {
    return '<span class="badge status-danger">Não seguro</span>';
  }
  return '<span class="badge status-unknown">Desconhecido</span>';
}

// ============ Chamadas de API ============

// ⚠️ IMPORTANTE: essas funções assumem endpoints padrão do Blockscout.
// Você precisa checar em https://testnet.arcscan.app/api-docs quais
// URLs existem de verdade e ajustar aqui se necessário.

async function fetchTopTokens() {
  try {
    // TODO: ajustar endpoint real se disponível.
    // Exemplo genérico de Blockscout:
    // const res = await fetch(`${API_BASE}/api/v2/tokens?type=ERC-20&page=1&page_size=50`);
    // if (!res.ok) throw new Error("API error");
    // const data = await res.json();
    // Transformar data no formato abaixo.

    // Por enquanto, usar mock:
    return MOCK_TOKENS;
  } catch (err) {
    console.error("Erro ao buscar tokens:", err);
    return MOCK_TOKENS; // fallback
  }
}

async function fetchTokenByAddress(address) {
  try {
    // TODO: trocar por chamada real ao ArcScan / Blockscout.
    // Exemplo conceitual:
    // const metaRes = await fetch(`${API_BASE}/api/v2/tokens/${address}`);
    // const holdersRes = await fetch(`${API_BASE}/api/v2/tokens/${address}/holders`);
    // const contractRes = await fetch(`${API_BASE}/api/v2/smart-contracts/${address}`);

    // if (!metaRes.ok) throw new Error("Token não encontrado");

    // const meta = await metaRes.json();
    // const holdersData = await holdersRes.json();
    // const contractData = await contractRes.json();

    // const token = {
    //   address,
    //   name: meta.name,
    //   symbol: meta.symbol,
    //   holders: holdersData.items?.length ?? meta.holders ?? 0,
    //   totalSupply: meta.total_supply,
    //   verified: contractData.is_verified ?? false,
    //   daysOld: calcDaysFrom(meta.creation_time),
    //   suspiciousFunctions: extractSuspiciousFunctions(contractData.abi)
    // };

    // Para MVP, se o endereço bater com algum mock, retorna ele:
    const mock = MOCK_TOKENS.find(
      (t) => t.address.toLowerCase() === address.toLowerCase()
    );
    if (mock) return mock;

    throw new Error("Token não encontrado (mock).");
  } catch (err) {
    console.error("Erro ao buscar token:", err);
    throw err;
  }
}

// Helpers se você for usar data real depois:
function calcDaysFrom(isoDate) {
  if (!isoDate) return null;
  const created = new Date(isoDate).getTime();
  const now = Date.now();
  const diff = now - created;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function extractSuspiciousFunctions(abiJson) {
  // Exemplo de inspeção de ABI se você tiver o JSON:
  // Parseia e procura funções como mint, pause, blacklist, etc.
  try {
    if (!abiJson) return [];
    const abi =
      typeof abiJson === "string" ? JSON.parse(abiJson) : abiJson;
    const bad = [];
    const sensitive = [
      "mint",
      "pause",
      "blacklist",
      "blackList",
      "setBlacklist",
      "owner",
      "setTax",
      "setFees"
    ];
    for (const item of abi) {
      if (item.type === "function" && sensitive.includes(item.name)) {
        bad.push(item.name);
      }
    }
    return bad;
  } catch {
    return [];
  }
}

// ============ Renderização ============

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
        <td colspan="5" style="font-size:13px; color:var(--muted); padding:10px;">
          Nenhum token encontrado para esse filtro.
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
        <div>${token.name || "Token sem nome"}</div>
        <div style="font-size:11px; color:var(--muted);">${token.symbol || ""}</div>
      </td>
      <td>
        <span class="addr-small">${shortAddr(token.address)}</span>
      </td>
      <td>${token.holders ?? "-"}</td>
      <td>${statusBadge(status)}</td>
      <td>
        <button class="btn ghost btn-sm" data-addr="${token.address}">Ver</button>
      </td>
    `;

    const btn = tr.querySelector("button");
    btn.addEventListener("click", () => renderTokenCard(token));

    tokensTbody.appendChild(tr);
  }
}

function renderTokenCard(token) {
  const { status, reasons } = computeRisk(token);

  searchResult.classList.remove("hidden");
  searchResult.innerHTML = `
    <div class="token-card-header">
      <div>
        <div class="token-name">${token.name || "Token sem nome"}</div>
        <div class="token-addr">${token.address}</div>
      </div>
      <div>${statusBadge(status)}</div>
    </div>
    <div class="token-meta">
      <div><strong>Símbolo:</strong> ${token.symbol || "-"}</div>
      <div><strong>Holders:</strong> ${token.holders ?? "-"}</div>
      <div><strong>Total Supply:</strong> ${token.totalSupply ?? "-"}</div>
      <div><strong>Idade estimada:</strong> ${
        token.daysOld != null ? token.daysOld + " dias" : "-"
      }</div>
      <div style="margin-top:6px;">
        <strong>Motivos do status:</strong>
        <ul style="margin:4px 0 0 18px; padding:0;">
          ${reasons.map((r) => `<li>${r}</li>`).join("")}
        </ul>
      </div>
      <div style="margin-top:8px; font-size:12px;">
        <a href="https://testnet.arcscan.app/token/${token.address}" target="_blank" rel="noopener noreferrer">
          Ver no ArcScan
        </a>
      </div>
    </div>
  `;
}

// ============ Utils ============

function shortAddr(addr) {
  if (!addr) return "-";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// ============ Eventos ============

analyzeBtn.addEventListener("click", async () => {
  const addr = searchInput.value.trim();
  searchError.classList.add("hidden");
  searchResult.classList.add("hidden");
  searchError.textContent = "";

  if (!addr || !addr.startsWith("0x") || addr.length < 20) {
    searchError.textContent = "Cole um endereço de contrato válido (0x...).";
    searchError.classList.remove("hidden");
    return;
  }

  try {
    const token = await fetchTokenByAddress(addr);
    renderTokenCard(token);
  } catch {
    searchError.textContent =
      "Não foi possível encontrar esse token (use um token válido ou teste com um dos mocks).";
    searchError.classList.remove("hidden");
  }
});

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    filterChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    const filter = chip.dataset.filter;
    renderTokensTable(ALL_TOKENS, filter);
  });
});

// ============ Inicialização ============

(async function init() {
  tokensLoading.classList.remove("hidden");
  tokensTable.classList.add("hidden");

  const tokens = await fetchTopTokens();
  ALL_TOKENS = tokens;
  tokensLoading.classList.add("hidden");
  tokensTable.classList.remove("hidden");

  renderTokensTable(ALL_TOKENS, "all");
})();
