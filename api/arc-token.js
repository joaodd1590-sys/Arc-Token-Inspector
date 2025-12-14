export default async function handler(req, res) {
  const { address } = req.query;

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return res.status(400).json({
      ok: false,
      type: "invalid",
      error: "Invalid address format"
    });
  }

  try {
    // ArcScan token registry
    const registryResp = await fetch(
      "https://testnet.arcscan.app/api?module=token&action=tokenlist"
    );

    if (!registryResp.ok) {
      throw new Error("ArcScan registry unavailable");
    }

    const registry = await registryResp.json();

    const token = registry?.result?.find(
      t => t.contractAddress.toLowerCase() === address.toLowerCase()
    );

    if (!token) {
      return res.json({
        ok: true,
        type: "wallet"
      });
    }

    return res.json({
      ok: true,
      type: "token",
      token: {
        name: token.name,
        symbol: token.symbol,
        decimals: Number(token.decimals),
        totalSupply: token.totalSupply
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: "Internal error"
    });
  }
}
