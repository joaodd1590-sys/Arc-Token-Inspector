// /api/arc-token.js

const RPC_URL = "https://testnet.arc.io/rpc"; // <-- RPC da ARC Testnet

const ERC20_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }]
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }]
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }]
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  }
];

async function ethCall(address, data) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: address, data }, "latest"]
    })
  });

  const json = await res.json();
  return json.result || null;
}

// very small encoder (no ethers.js needed)
function encodeSig(sig) {
  return "0x" + require("crypto").createHash("keccak256").update(sig).digest("hex").slice(0, 8);
}

export default async function handler(req, res) {
  const address = req.query.address;

  if (!address || !address.startsWith("0x")) {
    return res.status(400).json({ error: "Invalid address" });
  }

  let isToken = false;
  const token = {};

  try {
    // name()
    const name = await ethCall(address, encodeSig("name()"));
    if (name && name !== "0x") {
      token.name = Buffer.from(name.slice(2), "hex").toString().replace(/\0/g, "");
      isToken = true;
    }

    // symbol()
    const symbol = await ethCall(address, encodeSig("symbol()"));
    if (symbol && symbol !== "0x") {
      token.symbol = Buffer.from(symbol.slice(2), "hex").toString().replace(/\0/g, "");
      isToken = true;
    }

    // decimals()
    const decimals = await ethCall(address, encodeSig("decimals()"));
    if (decimals && decimals !== "0x") {
      token.decimals = parseInt(decimals, 16);
      isToken = true;
    }

    // totalSupply()
    const supply = await ethCall(address, encodeSig("totalSupply()"));
    if (supply && supply !== "0x") {
      token.totalSupply = BigInt(supply).toString();
      isToken = true;
    }
  } catch (e) {
    console.error(e);
  }

  if (!isToken) {
    return res.json({ isToken: false });
  }

  return res.json({
    isToken: true,
    ...token
  });
}
