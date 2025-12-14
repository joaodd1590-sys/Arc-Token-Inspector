// /api/arc-token.js

const RPC_URL = "https://rpc.testnet.arc.network";

// ERC-20 selectors FIXOS (padrão Ethereum)
const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd"
};

async function ethCall(to, data) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"]
    })
  });

  const json = await res.json();
  if (json.error) return "0x";
  return json.result || "0x";
}

/* ================= ABI DECODERS ================= */

function isZeroHex(hex) {
  return /^0x0*$/.test(hex);
}

function decodeString(hex) {
  if (!hex || hex === "0x" || isZeroHex(hex)) return null;

  const data = hex.slice(2);
  if (data.length < 128) return null;

  const offset = parseInt(data.slice(0, 64), 16) * 2;
  const length = parseInt(data.slice(offset, offset + 64), 16);
  if (!length || length > 256) return null;

  const start = offset + 64;
  const strHex = data.slice(start, start + length * 2);
  return Buffer.from(strHex, "hex").toString("utf8");
}

function decodeUint(hex) {
  if (!hex || hex === "0x" || isZeroHex(hex)) return null;
  return BigInt(hex).toString();
}

function decodeUint256(hex) {
  if (!hex || hex === "0x" || isZeroHex(hex)) return null;
  return Number(BigInt(hex));
}

/* ================= HANDLER ================= */

export default async function handler(req, res) {
  const address = req.query.address?.toLowerCase();

  if (!address || !/^0x[a-f0-9]{40}$/.test(address)) {
    return res.status(400).json({ isToken: false });
  }

  let validFields = 0;
  const token = {};

  // name()
  const nameHex = await ethCall(address, SELECTORS.name);
  token.name = decodeString(nameHex);
  if (token.name) validFields++;

  // symbol()
  const symbolHex = await ethCall(address, SELECTORS.symbol);
  token.symbol = decodeString(symbolHex);
  if (token.symbol) validFields++;

  // decimals()
  const decHex = await ethCall(address, SELECTORS.decimals);
  token.decimals = decodeUint256(decHex);
  if (token.decimals !== null) validFields++;

  // totalSupply()
  const supplyHex = await ethCall(address, SELECTORS.totalSupply);
  token.totalSupply = decodeUint(supplyHex);
  if (token.totalSupply) validFields++;

  // 🔒 REGRA FINAL
  if (validFields < 2) {
    return res.json({ isToken: false });
  }

  return res.json({
    isToken: true,
    ...token
  });
}
