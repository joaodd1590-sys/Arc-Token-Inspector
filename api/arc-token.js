export default async function handler(req, res) {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: "Missing address parameter" });
  }

  const RPC_URL = "https://testnet-rpc.arcology.net"; // RPC oficial do ARC Testnet

  // Função genérica para chamar métodos do contrato
  async function call(methodSignature) {
    const data = methodSignature; // já em formato hex
    const body = {
      jsonrpc: "2.0",
      method: "eth_call",
      params: [
        {
          to: address,
          data: data
        },
        "latest"
      ],
      id: 1
    };

    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const json = await response.json();

    return json.result;
  }

  try {
    // --- CALLS ---

    const nameHex = await call("0x06fdde03"); // name()
    const symbolHex = await call("0x95d89b41"); // symbol()
    const decimalsHex = await call("0x313ce567"); // decimals()
    const totalSupplyHex = await call("0x18160ddd"); // totalSupply()

    // --- Convertendo os retornos ---

    const name = Buffer.from(nameHex.replace("0x", "").slice(128), "hex")
      .toString()
      .replace(/\u0000/g, "");

    const symbol = Buffer.from(symbolHex.replace("0x", "").slice(128), "hex")
      .toString()
      .replace(/\u0000/g, "");

    const decimals = parseInt(decimalsHex, 16);

    const totalSupply = BigInt(totalSupplyHex).toString();

    // resposta final
    return res.status(200).json({
      name,
      symbol,
      decimals,
      totalSupply,
      holders: null, // não disponível via RPC
      transfers: null // idem
    });

  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch token data",
      details: err.message
    });
  }
}
