const ARC_RPC = "https://testnet.arc-rpc.io"; // ajuste se necessário

async function rpc(method, params = []) {
  try {
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
    if (json.error) return null;
    return json.result ?? null;
  } catch {
    return null;
  }
}

function isZeroHex(hex) {
  if (!hex || hex === "0x") return true;
  return /^0x0+$/.test(hex);
}

async function call(address, selector) {
  const res = await rpc("eth_call", [
    { to: address, data: selector },
    "latest"
  ]);

  if (!res || isZeroHex(res)) return null;
  return res;
}

export default async function handler(req, res) {
  const { address } = req.query;

  if (!address || !address.startsWith("0x")) {
    return res.json({ ok: false, type: "invalid" });
  }

  /* 1️⃣ BYTECODE CHECK */
  const code = await rpc("eth_getCode", [address, "latest"]);
  if (!code || isZeroHex(code)) {
    return res.json({ ok: true, type: "wallet" });
  }

  /* 2️⃣ ERC-20 CHECK */
  const name = await call(address, "0x06fdde03");       // name()
  const symbol = await call(address, "0x95d89b41");     // symbol()
  const decimals = await call(address, "0x313ce567");   // decimals()
  const supply = await call(address, "0x18160ddd");     // totalSupply()

  const erc20Score = [name, symbol, decimals, supply].filter(Boolean).length;

  if (erc20Score >= 2) {
    return res.json({ ok: true, type: "erc20" });
  }

  /* 3️⃣ ERC-721 CHECK (NFT) */
  const ownerOf = await call(address, "0x6352211e"); // ownerOf(uint256)

  if (ownerOf) {
    return res.json({ ok: true, type: "erc721" });
  }

  /* 4️⃣ OTHER CONTRACT */
  return res.json({ ok: true, type: "contract" });
}
