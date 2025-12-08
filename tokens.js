async function analyzeToken() {
    const address = document.getElementById("tokenAddress").value.trim();
    const statusBox = document.getElementById("statusBox");

    if (!address.startsWith("0x") || address.length < 10) {
        alert("Enter a valid ARC-20 address.");
        return;
    }

    const url = `/api/arc-token?address=${address}`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        document.getElementById("tName").innerText = data.name || "-";
        document.getElementById("tSymbol").innerText = data.symbol || "-";
        document.getElementById("tDecimals").innerText = data.decimals ?? "-";
        document.getElementById("tSupply").innerText = data.totalSupply ?? "-";

        document.getElementById("loadedMsg").innerText = "Token loaded successfully.";

        updateRiskStatus(data);

    } catch (e) {
        alert("Error fetching token.");
    }
}

function updateRiskStatus(token) {
    const box = document.getElementById("statusBox");
    box.className = ""; // reset

    let status = "Unknown";
    let className = "status-warning";

    // Simple heuristic:
    if (token.name === "USDC") {
        status = "Trusted";
        className = "status-trusted";
    } else if (!token.decimals || !token.symbol) {
        status = "Risky";
        className = "status-risky";
    }

    box.classList.add("status-badge", className);
    box.innerText = status;
}
