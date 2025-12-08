export default async function handler(req, res) {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: "Missing address parameter" });
  }

  const RPC_URL = "https://rpc-testnet.arc.market";

  async function rpcCall(dataHex) {
    const body = {
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        { to: address, data: dataHex },
        "latest"
      ],
      id: 1
    };

    try {
      const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("RPC responded with status " + response.status);
      }

      const json = await response.json();

      if (!json.result) {
        throw new Error("RPC returned null result");
      }

      return json.result;

    } catch (err) {
      console.error("RPC error:", err);
      throw err;
    }
  }

  try {
    const nameHex    = await rpcCall("0x06fdde03"); // name()
    const symbolHex  = await rpcCall("0x95d89b41"); // symbol()
    const decimalsHex = await rpcCall("0x313ce567"); // decimals()
    const totalSupplyHex = await rpcCall("0x18160ddd"); // totalSupply()

    function decodeString(hex) {
      const clean = hex.replace("0x", "");
      const str = Buffer.from(clean.slice(128), "hex").toString();
      return str.replace(/\u0000/g, "");
    }

    const name = decodeString(nameHex);
    const symbol = decodeString(symbolHex);
    const decimals = parseInt(decimalsHex, 16);
    const totalSupply = BigInt(totalSupplyHex).toString();

    return res.status(200).json({
      name,
      symbol,
      decimals,
      totalSupply,
      holders: null,
      transfers: null
    });

  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch token data",
      details: err.message,
    });
  }
}
