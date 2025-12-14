/**
 * Address detection utility
 *
 * Correctly distinguishes between:
 * - Wallet (EOA)
 * - Non-token contracts
 * - ERC-20 token contracts
 *
 * This implementation is hardened against:
 * - Zero-filled RPC responses
 * - Inconsistent eth_call / eth_getCode behavior
 * - False positives caused by buggy RPCs
 */

// Minimal ERC-20 selectors
const ERC20_SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd"
};

// ---------- RPC helper ----------
async function rpc(method, params = []) {
  const res = await fetch("https://testnet.arcscan.app/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  const json = await res.json();
  return json.result;
}

// ---------- Helper: meaningful hex ----------
function isMeaningfulHex(hex) {
  if (!hex || hex === "0x") return false;

  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (stripped.length === 0) return false;

  // Reject zero-filled responses (0000...)
  return !/^0+$/.test(stripped);
}

// ---------- ERC-20 call check ----------
async function callERC20(address, selector) {
  try {
    const result = await rpc("eth_call", [
      { to: address, data: selector },
      "latest"
    ]);

    // Accept only meaningful, non-zero responses
    return isMeaningfulHex(result);
  } catch {
    return false;
  }
}

// ---------- Main detection ----------
export async function detectAddressType(address) {
  if (!address || !address.startsWith("0x")) {
    return { type: "invalid" };
  }

  /* ------------------------------------------------
     1) Check if address has bytecode
  --------------------------------------------------*/
  let code;
  try {
    code = await rpc("eth_getCode", [address, "latest"]);
  } catch {
    return { type: "unknown" };
  }

  const normalizedCode = (code || "0x").toLowerCase().trim();

  // Wallet / EOA → no bytecode
  if (
    !normalizedCode ||
    normalizedCode === "0x" ||
    /^0x0+$/.test(normalizedCode)
  ) {
    return { type: "wallet" };
  }

  /* ------------------------------------------------
     2) Check ERC-20 interface heuristically
     (at least 2 valid responses required)
  --------------------------------------------------*/
  let hits = 0;

  for (const selector of Object.values(ERC20_SELECTORS)) {
    const ok = await callERC20(address, selector);
    if (ok) hits++;
  }

  // Threshold: require multiple ERC-20 signals
  if (hits >= 2) {
    return { type: "token" };
  }

  /* ------------------------------------------------
     3) Contract, but not ERC-20
  --------------------------------------------------*/
  return { type: "contract" };
}
