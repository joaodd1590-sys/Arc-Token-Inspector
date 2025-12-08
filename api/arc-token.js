export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { address } = req.query;

  if (!address || !address.startsWith("0x")) {
    res.status(400).json({ error: "Invalid or missing address" });
    return;
  }

  try {
    // 🔥 AQUI ESTÁ A API INTERNA OFICIAL DO ARCSCAN
    const ARC_INTERNAL_URL =
      `https://testnet.arcscan.app/api/v2/tokens/advanced-filter.json` +
      `?token_contract_address_hashes[]=${address}`;

    const resp = await fetch(ARC_INTERNAL_URL, {
      headers: {
        "accept": "application/json",
        "user-agent": "Arc-Token-Inspector/1.0"
      }
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Arc internal error:", resp.status, errText);
      res.status(resp.status).json({ error: "Arc internal API error" });
      return;
    }

    const raw = await resp.json();

    // Normalmente os dados vêm em raw.items[0]
    const item = raw?.items?.[0] || {};

    const token = {
      name: item.name || "Unknown",
      symbol: item.symbol || "???",
      decimals: item.decimals || null,
      totalSupply: item.total_supply || null,
      holders: item.holders || null
    };

    res.status(200).json(token);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Internal proxy error" });
  }
}
