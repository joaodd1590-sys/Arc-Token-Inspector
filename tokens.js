// ================================
// ARC TOKEN INSPECTOR - tokens.js
// ================================

// Seleciona elementos
const input = document.getElementById("tokenInput");
const button = document.getElementById("analyzeBtn");
const resultBox = document.getElementById("result");

// ================================
// FUNÇÃO DE RISCO (HEURÍSTICA)
// ================================
function getRiskStatus(totalSupply) {
    if (!totalSupply || isNaN(totalSupply)) return "unknown";

    const supply = Number(totalSupply);

    // Lógica simples mas funcional
    if (supply > 1_000_000_000_000) return "trusted";     // seguro
    if (supply > 1_000_000_000) return "warning";         // médio
    return "risky";                                       // arriscado
}

// Retorna a classe CSS da badge
function getBadgeClass(status) {
    switch (status) {
        case "trusted":
            return "status-badge status-trusted";
        case "warning":
            return "status-badge status-warning";
        case "risky":
            return "status-badge status-risky";
        default:
            return "status-badge";
    }
}

// ================================
// FUNÇÃO PARA EXIBIR O TOKEN
// ================================
function showToken(data) {
    const status = getRiskStatus(data.totalSupply);
    const statusClass = getBadgeClass(status);

    resultBox.innerHTML = `
        <div class="token-box">
            <h2>${data.name} (${data.symbol})</h2>

            <span class="${statusClass}">
                ${status.toUpperCase()}
            </span>

            <p><strong>Decimals:</strong> ${data.decimals ?? "N/A"}</p>
            <p><strong>Total Supply:</strong> ${data.totalSupply ?? "N/A"}</p>

            <p style="opacity:0.7; margin-top:10px;">
                Token loaded successfully.
            </p>
        </div>
    `;
}

// ================================
// CHAMAR A API DO VERCEL
// ================================
async function analyzeToken() {
    const address = input.value.trim();

    if (!address || !address.startsWith("0x")) {
        resultBox.innerHTML = `<p style="color:#ff4747;">Invalid token address.</p>`;
        return;
    }

    resultBox.innerHTML = `<p>Loading...</p>`;

    try {
        const response = await fetch(`/api/arc-token?address=${address}`);

        const data = await response.json();

        if (data.error) {
            resultBox.innerHTML = `<p style="color:#ff4747;">API Error: ${data.error}</p>`;
            return;
        }

        showToken(data);

    } catch (err) {
        console.error(err);
        resultBox.innerHTML = `<p style="color:#ff4747;">Unexpected error while analyzing token.</p>`;
    }
}

// ================================
// EVENTOS
// ================================
button.addEventListener("click", analyzeToken);

input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") analyzeToken();
});
