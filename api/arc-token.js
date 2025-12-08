// api/arc-token.js
//
// Backend proxy para o ArcScan (rodando no Vercel).
// Esse endpoint recebe ?address=0x123... e consulta a API interna do ArcScan.
// Depois devolve um JSON limpo com: name, symbol, decimals, totalSupply, holders.
//
// IMPORTANTE: você deve substituir ARC_INTERNAL_URL aqui embaixo
// pela URL real que você vai pegar no DevTools → Network do ArcScan.

export default async function handler(req, res) {
  // Só permite GET
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
    // ❗ PASSO 1 — URL da API interna do ArcScan
    //
    // Você precisa abrir:
    // https://testnet.arcscan.app/tokens
    // Clicar em um token
    // Abrir o DevTools → Network
    // Filtrar por "token", "graphql", "api", "v2", etc.
    //
    // Quando encontrar o endpoint *real*, substitua aqui.
    //
    // Exemplo (placeholder):
    //
    // const ARC_INTERNAL_URL = `https://testnet.arcscan.app/api/internal/token?address=${address}`;
    //
    // ❗ DEIXE ASSIM POR ENQUANTO — depois você troca pelo real:
    const ARC_INTERNAL_URL = `https://testnet.arcscan.app/api?module=token&action=getToken&contractaddress=${address}`;

    // Faz a chamada real
    const resp = await fetch(ARC_INTERNAL_URL, {
      headers: {
        "accept": "application/json",
        "user-agent": "Arc-Token-Inspector/1.0"
      }
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Arc API error:", resp.status, errText);
      res.status(resp.status).json({ error: "Arc API returned an error" });
      return;
    }

    const raw = await resp.json();

    // PASSO 2 — Limpar e montar o JSON de saída
    const token = {
      name: raw?.result?.name || raw.name || "Unknown",
      symbol: raw?.result?.symbol || raw.symbol || "???",
      decimals: raw?.result?.decimals || null,
      totalSupply: raw?.result?.totalSupply || null,
      holders: raw?.result?.holders || raw.holders || null
    };

    res.status(200).json(token);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Internal proxy error" });
  }
}
