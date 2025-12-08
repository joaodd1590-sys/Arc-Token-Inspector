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
    // 🔥 URL interna oficial usada pelo ArcScan (Next.js data fetch)
    const ARC_INTERNAL_URL =
      `https://testnet.arcscan.app/_next/data/PT2Y1HFDaA9IV807_Kj/advanced-filter.json` +
      `?token_contract_address_hashes_to_include=${address}`;

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

    // Estrutura real do Next.js:
    // raw.pageProps.tokens.items[0]
    const item = raw?.pageProps?.tokens?.items?.[0];

    if (!item) {
      res.status(404).json({ error: "Token not found in Arc internal API" });
      return;
    }

    const token = {
      name: item.name || "Unknown",
      symbol: item.symbol || "???",
      decimals: item.decimals || null,
      totalSupply: item.total_supply || null,
      holders: item.holders || item.holder_count || null
    };

    res.status(200).json(token);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Internal proxy error" });
  }
}
