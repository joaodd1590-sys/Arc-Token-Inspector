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
    // 1️⃣ Buscar HTML inicial do ArcScan para extrair o buildId
    const htmlResp = await fetch("https://testnet.arcscan.app", {
      headers: { "user-agent": "Arc-Inspector" }
    });

    const html = await htmlResp.text();

    // 2️⃣ Capturar automaticamente o buildId do Next.js
    const buildIdMatch = html.match(/"buildId":"([^"]+)"/);

    if (!buildIdMatch) {
      return res.status(500).json({ error: "Failed to fetch ArcScan buildId" });
    }

    const buildId = buildIdMatch[1];

    // 3️⃣ Agora montamos a URL REAL do ArcScan com o buildId atualizado
    const apiUrl =
      `https://testnet.arcscan.app/_next/data/${buildId}/advanced-filter.json` +
      `?token_contract_address_hashes_to_include=${address}`;

    const apiResp = await fetch(apiUrl, {
      headers: {
        "accept": "application/json",
        "user-agent": "Arc-Inspector"
      }
    });

    if (!apiResp.ok) {
      const text = await apiResp.text();
      console.error("Arc error:", apiResp.status, text);
      return res.status(500).json({ error: "Arc internal API error" });
    }

    const data = await apiResp.json();

    // 4️⃣ Acessar o token
    const item = data?.pageProps?.tokens?.items?.[0];

    if (!item) {
      return res.status(404).json({ error: "Token not found" });
    }

    // 5️⃣ Formatar resposta
    const token = {
      name: item.name || "Unknown",
      symbol: item.symbol || "???",
      decimals: item.decimals || null,
      totalSupply: item.total_supply || null,
      holders: item.holders || item.holder_count || null,
    };

    res.status(200).json(token);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Internal proxy error" });
  }
}
