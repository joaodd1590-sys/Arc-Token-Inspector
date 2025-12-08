const btn = document.getElementById("analyzeBtn");
const input = document.getElementById("tokenAddress");


const box = document.getElementById("result");
const tName = document.getElementById("tName");
const tSymbol = document.getElementById("tSymbol");
const tDecimals = document.getElementById("tDecimals");
const tSupply = document.getElementById("tSupply");
const statusMsg = document.getElementById("statusMsg");


btn.addEventListener("click", async () => {
const address = input.value.trim();


if (!address || !address.startsWith("0x")) {
statusMsg.textContent = "Invalid token address.";
box.classList.remove("hidden");
return;
}


statusMsg.textContent = "Loading...";
box.classList.remove("hidden");


try {
const resp = await fetch(`/api/arc-token?address=${address}`);
const data = await resp.json();


if (!resp.ok) {
statusMsg.textContent = data.error || "Error fetching token data.";
return;
}


tName.textContent = data.name || "-";
tSymbol.textContent = data.symbol || "-";
tDecimals.textContent = data.decimals ?? "-";
tSupply.textContent = data.totalSupply || "-";


statusMsg.textContent = "Token loaded successfully.";


} catch (err) {
statusMsg.textContent = "Failed to load token data.";
}
});
