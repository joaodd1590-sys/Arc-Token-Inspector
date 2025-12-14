// /api/arc-token.js

const RPC_URL = "https://rpc.testnet.arc.network";

function keccak256(str) {
  return (
    "0x" +
    require("crypto")
      .createHash("keccak256")
      .update(str)
      .digest("hex")
      .slice(0, 8)
  );
}

const SELECTORS = {
  name: keccak256("name()"),
  symbol: keccak256("symbol()"),
  decimals: keccak256("decimals()"),
  totalSupply: keccak256("totalSupply()"),
};

async function rpc(method, params) {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });

    const json = await res.json();
    if (json.error) return null;
    return json.result;
  } catch {
    return null;
  }
}

async function ethCall(to, data) {
  return rpc("eth_call", [{ to, data }, "latest"]);
}

// ABI decoders
function decodeString(hex) {
  if (!hex || hex === "0x") return null;
  const data = hex.slice(2);
  if (data.length < 128) return null;

  const offset = parseInt(data.slice(0, 64), 16) * 2;
  const length = parseInt(data.slice(offset, offset + 64), 16);
  const strHex = data.slice(offset + 64, offset + 64 + length * 2);
  return Buffer.from(strHex, "hex").toString("utf8") || null;
}

function decodeUint(hex) {
  if (!hex || hex === "0x") return null;
  return BigInt(hex).toString();
}

function decodeUint8(hex) {
  if (!hex || hex === "0x") return null;
  return parseInt(hex, 16);
}

// 🔥 Fetch token icon from ArcScan
async function fetchTokenIcon(address) {
  try {
    const res = await fetch(
      `https://testnet.arcscan.app/api/token/${address}`
    );
    const json = await res.json();
    return json?.icon || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const address = req.query.address?.toLowerCase();

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return res.status(400).json({ isToken: false });
  }

  // 1️⃣ Wallet vs contract
  const code = await rpc("eth_getCode", [address, "latest"]);
  if (!code || code === "0x" || /^0x0+$/.test(code)) {
    return res.json({ isToken: false });
  }

  const token = {};
  let valid = 0;

  try {
    const nameHex = await ethCall(address, SELECTORS.name);
    token.name = decodeString(nameHex);
    if (token.name) valid++;

    const symbolHex = await ethCall(address, SELECTORS.symbol);
    token.symbol = decodeString(symbolHex);
    if (token.symbol) valid++;

    const decHex = await ethCall(address, SELECTORS.decimals);
    token.decimals = decodeUint8(decHex);
    if (token.decimals !== null) valid++;

    const supHex = await ethCall(address, SELECTORS.totalSupply);
    token.totalSupply = decodeUint(supHex);
    if (token.totalSupply) valid++;
  } catch {
    return res.json({ isToken: false });
  }

  if (valid < 2) {
    return res.json({ isToken: false });
  }

  token.icon = await fetchTokenIcon(address);

  res.json({
    isToken: true,
    token,
  });
}
