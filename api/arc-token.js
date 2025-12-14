export default async function handler(req, res) {
  try {
    const { address, network } = req.query;
    const addr = String(address || "").trim();

    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return res.status(400).json({ ok: false, error: "invalid_address" });
    }

    // For now: only ARC Testnet
    const explorerBase = "https://testnet.arcscan.app";

    // 1) Contract vs wallet using eth_getCode
    const codeResp = await fetch(
      `${explorerBase}/api?module=proxy&action=eth_getCode&address=${addr}&tag=latest`,
      { headers: { "accept": "application/json" } }
    );

    const codeJson = await codeResp.json();
    const code = (codeJson && codeJson.result) ? String(codeJson.result) : "0x";

    if (!code || code === "0x") {
      return res.status(200).json({ ok: true, type: "wallet" });
    }

    // 2) Try ERC-20 reads via eth_call
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      ethCallString(explorerBase, addr, "0x06fdde03"), // name()
      ethCallString(explorerBase, addr, "0x95d89b41"), // symbol()
      ethCallUint(explorerBase, addr, "0x313ce567"),   // decimals()
      ethCallUint(explorerBase, addr, "0x18160ddd")    // totalSupply()
    ]);

    const looksLikeToken =
      (typeof symbol === "string" && symbol.length > 0) ||
      (typeof name === "string" && name.length > 0);

    if (!looksLikeToken) {
      return res.status(200).json({ ok: true, type: "nonTokenContract" });
    }

    return res.status(200).json({
      ok: true,
      type: "token",
      token: {
        name: name || "",
        symbol: symbol || "",
        decimals: decimals ?? null,
        totalSupply: totalSupply ?? null
      }
    });
  } catch (e) {
    console.error("arc-token api error:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

async function ethCall(explorerBase, to, data) {
  const url = `${explorerBase}/api?module=proxy&action=eth_call&to=${to}&data=${data}&tag=latest`;
  const r = await fetch(url, { headers: { "accept": "application/json" } });
  const j = await r.json();
  return j && j.result ? String(j.result) : "0x";
}

async function ethCallUint(explorerBase, to, data) {
  try {
    const hex = await ethCall(explorerBase, to, data);
    if (!hex || hex === "0x") return null;
    // strip 0x, parse as BigInt
    const v = BigInt(hex);
    // decimals fits number; totalSupply might be huge -> return string
    if (data === "0x313ce567") return Number(v);
    return v.toString();
  } catch {
    return null;
  }
}

async function ethCallString(explorerBase, to, data) {
  try {
    const hex = await ethCall(explorerBase, to, data);
    if (!hex || hex === "0x") return "";

    // Try decode as ABI string (dynamic)
    // Layout: 0x + [offset(32)] + [len(32)] + [bytes...]
    const buf = Buffer.from(hex.slice(2), "hex");
    if (buf.length < 64) return "";

    const offset = Number(readUint256(buf, 0));
    if (!Number.isFinite(offset) || offset + 32 > buf.length) return "";

    const len = Number(readUint256(buf, offset));
    if (!Number.isFinite(len) || offset + 32 + len > buf.length) return "";

    const strBytes = buf.subarray(offset + 32, offset + 32 + len);
    return strBytes.toString("utf8").replace(/\0/g, "");
  } catch {
    return "";
  }
}

function readUint256(buf, start) {
  const slice = buf.subarray(start, start + 32);
  let hex = slice.toString("hex");
  if (!hex) return 0n;
  return BigInt("0x" + hex);
}
