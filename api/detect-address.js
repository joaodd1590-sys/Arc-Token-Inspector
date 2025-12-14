const ARC_RPC = "https://testnet-rpc.arc.io"; 
// ⚠️ use o RPC oficial correto da ARC Testnet

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

async function callERC20(address, selector) {
  try {
    const result = await rpc("eth_call", [
      { to: address, data: selector },
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

  /* 1️⃣ Check if address has bytecode */
  const code = await rpc("eth_getCode", [address, "latest"]);

  if (!code || code === "0x") {
    return res.json({ type: "wallet" });
  }

  /* 2️⃣ Check ERC-20 interface */
  const selectors = [
    "0x06fdde03", // name()
    "0x95d89b41", // symbol()
    "0x313ce567", // decimals()
    "0x18160ddd"  // totalSupply()
  ];

  let hits = 0;
  for (const sig of selectors) {
    if (await callERC20(address, sig)) hits++;
  }

  if (hits >= 2) {
    return res.json({
      type: "token",
      erc20: true,
      confidence: hits
    });
  }

  return res.json({
    type: "contract",
    erc20: false
  });
}
