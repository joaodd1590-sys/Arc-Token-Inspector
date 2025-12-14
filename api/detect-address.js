// Server-side only (Vercel / Node.js)

const ARC_RPC = "https://testnet-rpc.arc.io"; 
// ⬆️ troque pelo RPC oficial da ARC Testnet se for outro

async function rpc(method, params = []) {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  const json = await res.json();
  return json.result;
}

async function callERC20(address, sig) {
  try {
    const data = sig;
    const result = await rpc("eth_call", [
      { to: address, data },
      "latest"
    ]);
    return result && result !== "0x";
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const { address } = req.query;

  if (!address || !address.startsWith("0x")) {
    return res.status(400).json({ error: "Invalid address" });
  }

  // 1️⃣ Check bytecode
  const code = await rpc("eth_getCode", [address, "latest"]);

  if (!code || code === "0x") {
    return res.json({
      type: "wallet"
    });
  }

  // 2️⃣ ERC-20 function selectors
  const checks = {
    name: "0x06fdde03",
    symbol: "0x95d89b41",
    decimals: "0x313ce567",
    totalSupply: "0x18160ddd"
  };

  let success = 0;

  for (const sig of Object.values(checks)) {
    const ok = await callERC20(address, sig);
    if (ok) success++;
  }

  if (success >= 2) {
    return res.json({
      type: "token",
      erc20: true,
      confidence: success
    });
  }

  return res.json({
    type: "contract",
    erc20: false
  });
}
