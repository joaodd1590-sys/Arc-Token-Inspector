export default async function handler(req, res) {
  const { address } = req.query;

  if (!address || !address.startsWith("0x")) {
    return res.status(400).json({ error: "Invalid or missing token address" });
  }

  try {
    // 1️⃣ Buscar HTML inicial para extrair o buildId
    const htmlResp = await fetch("https://testnet.arcscan.app");
    const html = await htmlResp.text();

    const buildIdMatch = html.match(/"buildId":"([^"]+)"/);

    if (!buildIdMatch) {
      return res.status(500).json({ error: "Failed to detect ArcScan build ID" });
    }

    const buildId = buildIdMatch[1];

    // 2️⃣ Montar URL correta da API de detalhes do token
    const url =
      `https://testnet.arcscan.app/_next/data/${buildId}/address/${address}.json?hash=${address}`;

    const apiResp = await fetch(url);

    if (!apiResp.ok) {
      return res.status(500).json({
        error: "Arc internal API error (details request)",
        status: apiResp.status
      });
    }

    const data = await apiResp.json();

    // 3️⃣ Extrair as informações do token
    const token = data?.pageProps?.addressData;

    if (!token) {
      return res.status(404).json({ error: "Token not found" });
    }

    // 4️⃣ Normalizar os dados
    const formatted = {
      name: token?.metadata?.name || token?.symbol || "Unknown",
      symbol: token?.metadata?.symbol || "???",
      decimals: token?.metadata?.decimals || null,
      totalSupply: token?.totalSupply || null,
      type: token?.type || null,
      holders: token?.holderCount || token?.holders || null,
      transfers: token?.transferCount || null
    };

    return res.status(200).json(formatted);

  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
