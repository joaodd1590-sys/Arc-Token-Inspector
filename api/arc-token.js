// /api/arc-token.js

const RPC_URL = "https://rpc.testnet.arc.network"; // Updated public ARC Testnet RPC

function keccak256(str) {
  return "0x" + require("crypto").createHash("keccak256").update(str).digest("hex").slice(0, 8);
}

const SELECTORS = {
  name: keccak256("name()"),
  symbol: keccak256("symbol()"),
  decimals: keccak256("decimals()"),
  totalSupply: keccak256("totalSupply()")
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
  if (json.error) throw new Error(json.error.message);
  return json.result || "0x";
}

// Proper ABI decoders
function decodeString(hex) {
  if (hex === "0x") return null;
  const data = hex.slice(2);
  const offset = parseInt(data.slice(0, 64), 16) * 2;
  const length = parseInt(data.slice(offset, offset + 64), 16);
  const strStart = offset + 64;
  const strHex = data.slice(strStart, strStart + length * 2);
  return Buffer.from(strHex, "hex").toString("utf8");
}

function decodeUint(hex) {
  if (hex === "0x") return null;
  return BigInt(hex).toString();
}

function decodeUint8(hex) {
  if (hex === "0x") return null;
  return parseInt(hex, 16);
}

export default async function handler(req, res) {
  const address = req.query.address?.toLowerCase();

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return res.status(400).json({ error: "Invalid address" });
  }

  const token = {};
  let validFields = 0;

  try {
    // name()
    const nameHex = await ethCall(address, SELECTORS.name);
    if (nameHex !== "0x") {
      token.name = decodeString(nameHex);
      if (token.name) validFields++;
    }

    // symbol()
    const symbolHex = await ethCall(address, SELECTORS.symbol);
    if (symbolHex !== "0x") {
      token.symbol = decodeString(symbolHex);
      if (token.symbol) validFields++;
    }

    // decimals()
    const decHex = await ethCall(address, SELECTORS.decimals);
    if (decHex !== "0x") {
      token.decimals = decodeUint8(decHex);
      if (token.decimals !== null) validFields++;
    }

    // totalSupply()
    const supplyHex = await ethCall(address, SELECTORS.totalSupply);
    if (supplyHex !== "0x") {
      token.totalSupply = decodeUint(supplyHex);
      if (token.totalSupply !== null) validFields++;
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "RPC error" });
  }

  if (validFields < 2) {
    return res.json({ isToken: false });
  }

  res.json({
    isToken: true,
    ...token
  });
}
