// Configuração da rede
const NETWORKS = {
  arcTestnet: {
    label: "ARC Testnet",
    explorerBase: "https://testnet.arcscan.app"
  }
};

// Lista de tokens confiáveis (allowlist manual)
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet",
    refSupply: "25245628768486750"
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

/* -------------------------
   Tema (light/dark)
--------------------------*/
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  const body = document.body;

  btn.addEventListener("click", () => {
    const next = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", next);
    btn.textContent = next === "dark" ? "🌙" : "☀️";
  });
}

/* -------------------------
   Copiar endereço
--------------------------*/
function initCopy() {
  const btn = document.getElementById("copyAddressBtn");
  btn.addEventListener("click", async () => {
    const full = document.getElementById("tokenAddressShort")?.dataset.full;
    if (!full) return;

    await navigator.clipboard.writeText(full);
    btn.textContent = "✔ Copied";
    setTimeout(() => (btn.textContent = "📋 Copy"), 1000);
  });
}

/* -------------------------
   Verificação de Contrato
--------------------------*/
async function isContractAddress(address) {
  try {
    // Chamada para ArcScan para verificar se o endereço tem bytecode
    const res = await fetch(
      `https://testnet.arcscan.app/api?module=proxy&action=eth_getCode&address=${address}&tag=latest`
    );
    const json = await res.json();

    // Se o retorno não for "0x", é um contrato
    if (json.result && json.result !== "0x") {
      return true; // É um contrato válido
    }

    return false; // Caso contrário, é uma wallet ou contrato inválido
  } catch (e) {
    console.error("Erro ao verificar o contrato:", e);
    return false; // Caso ocorra erro, trata como wallet
  }
}

// Função para verificar se o endereço está listado como um token na ArcScan
async function isTokenListed(address) {
  try {
    // Verifica se o endereço é um token registrado na ArcScan
    const res = await fetch(`https://testnet.arcscan.app/api?module=token&action=getTokenInfo&address=${address}`);
    const json = await res.json();
    return json.result && json.result.status === "1"; // Se o token existir, retorna true
  } catch (e) {
    console.error("Erro ao verificar se o token está listado:", e);
    return false;
  }
}

/* -------------------------
   Erro de Wallet
--------------------------*/
function showWalletInputError() {
  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const explorerLink = document.getElementById("explorerLink");

  tokenCard.classList.add("hidden");
  riskCard.classList.remove("hidden");

  // Esconde o link do explorador para wallets
  if (explorerLink) explorerLink.style.display = "none";

  document.getElementById("riskPill").className = "risk-pill risk-warning";
  document.getElementById("riskPill").textContent = "⚠️ Invalid input";
  document.getElementById("riskTitle").textContent = "Wallet address detected.";
  document.getElementById("riskDescription").textContent =
    "This tool analyzes ARC-20 token contracts only.";

  document.querySelector(".risk-notes").innerHTML = `
    <li>Please enter a valid ARC-20 contract address.</li>
    <li>No token analysis was performed.</li>
  `;
}

/* -------------------------
   Função principal de análise
--------------------------*/
async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();
  if (!addr.startsWith("0x")) return alert("Invalid address.");

  const normalized = addr.toLowerCase();
  const explorerLink = document.getElementById("explorerLink");

  // Resetando o estado do link do explorador
  if (explorerLink) explorerLink.style.display = "none";

  // Verificação de Wallet vs Contrato
  const isContract = await isContractAddress(addr);
  if (!isContract || !(await isTokenListed(addr))) {
    showWalletInputError();
    return;
  }

  // Se for um contrato válido, prosseguir com a análise
  const resp = await fetch(`/api/arc-token?address=${addr}&network=arcTestnet`);
  const data = await resp.json();

  if (!data || !data.name) {
    alert("Token not found.");
    return;
  }

  fillTokenInfo(addr, data);
  applyRisk(addr, data);

  // Liberando o link de explorador
  if (explorerLink) {
    explorerLink.href = `https://testnet.arcscan.app/token/${addr}`;
    explorerLink.textContent = "View on explorer ↗";
    explorerLink.style.display = "inline";
  }

  document.getElementById("tokenCard").classList.remove("hidden");
  document.getElementById("riskCard").classList.remove("hidden");
}

/* -------------------------
   Preencher as informações do token
--------------------------*/
function fillTokenInfo(address, token) {
  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent = token.decimals ?? "-";
  document.getElementById("tSupplyRaw").textContent = token.totalSupply || "-";
  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const addrEl = document.getElementById("tokenAddressShort");
  addrEl.textContent = short;
  addrEl.dataset.full = address;
}

/* -------------------------
   Aplicar análise de risco
--------------------------*/
function applyRisk(address, token) {
  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];

  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");

  riskPill.className = "risk-pill";

  if (trusted) {
    riskPill.textContent = "🟢 Trusted";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "Trusted token";
    riskDesc.textContent = trusted.note;

    document.querySelector(".risk-notes").innerHTML = `
      <li>Allowlisted official asset.</li>
      <li>Still verify via official explorer.</li>
    `;
    return;
  }

  riskPill.textContent = "⚠️ Risky";
  riskPill.classList.add("risk-warning");
  riskTitle.textContent = "Heuristic risk detected.";
  riskDesc.textContent = "Token shows unusual characteristics.";
}

/* -------------------------
   Funções auxiliares
--------------------------*/
function formatSupply(raw, dec) {
  try {
    const v = BigInt(raw);
    const d = BigInt(dec);
    return (v / 10n ** d).toLocaleString();
  } catch {
    return "-";
  }
}
