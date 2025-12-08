export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { address } = req.query;

  if (!address || !address.startsWith("0x")) {
    return res.status(400).json({ error: "Invalid or missing address" });
  }

  try {
    // URL do ArcScan NEXT API (modelo real)
    const ARC_URL = `https://testnet.arcscan.app/_next/data/YITlUVkOslu2CqsxW5-nd/address/${address}.json?hash=${address}`;

    const response = await fetch(ARC_URL, {
      headers: {
        "accept": "application/json",
        "user-agent": "Arc-Token-Inspector/1.0"
      }
    });

    if (!response.ok) {
      return res.status(500).json({ error: "Arc API returned error" });
    }

    const data = await response.json();

    // DADOS PUROS DO ARC
    const info = data?.pageProps?.details;

    const token = {
      name: info?.name || "Unknown",
      symbol: info?.symbol || "???",
      decimals: info?.decimals ?? null,
      totalSupply: info?.total_supply ?? null,
      holders: info?.holder_count ?? null
    };

    return res.status(200).json(token);

  } catch (err) {
    console.error("Arc proxy error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
