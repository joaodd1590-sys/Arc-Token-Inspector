export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { address } = req.query;

  if (!address || !address.startsWith("0x")) {
    return res.status(400).json({ error: "Invalid or missing address" });
  }

  try {
    // Endpoint público REAL do ArcScan
    const ARC_PUBLIC_URL = `https://testnet.arcscan.app/api?module=token&action=getToken&contractaddress=${address}`;

    const resp = await fetch(ARC_PUBLIC_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "Arc-Token-Inspector/1.0"
      }
    });

    if (!resp.ok) {
      return res.status(resp.status).json({
        error: "Arc API returned an error"
      });
    }

    const raw = await resp.json();

    // Resultado "limpo" que você vai usar no frontend
    const token = {
      name: raw?.result?.name || "Unknown",
      symbol: raw?.result?.symbol || "???",
      decimals: raw?.result?.decimals || null,
      totalSupply: raw?.result?.totalSupply || null
    };

    return res.status(200).json(token);

  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal proxy error" });
  }
}
