document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
  document.getElementById("tokenAddress").addEventListener("keydown", e => {
    if (e.key === "Enter") handleAnalyze();
  });
});

async function handleAnalyze() {
  const addr = document.getElementById("tokenAddress").value.trim();

  if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
    alert("Invalid address.");
    return;
  }

  resetUI();
  showLoading();

  try {
    const resp = await fetch(`/api/arc-token?address=${addr}`);
    const data = await resp.json();

    if (!data.ok || data.type !== "token") {
      showNotTokenError();
      return;
    }

    fillTokenInfo(addr, data.token);
    applyRisk(data.token);
    showSuccess(addr);

  } catch (e) {
    console.error(e);
    showGenericError();
  }
}
