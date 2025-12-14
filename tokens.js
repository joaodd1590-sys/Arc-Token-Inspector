// ARC Token Inspector - main logic
// Comments written as if the project owner authored them.

const NETWORKS = {
  arcTestnet: {
    label: "ARC Testnet",
    explorerBase: "https://testnet.arcscan.app"
  },
  arcMainnet: {
    label: "ARC Mainnet",
    explorerBase: "https://arcscan.app"
  }
};

// Manual allowlist for official contracts (optional shortcut, not required for scoring)
const TRUSTED_TOKENS = {
  "0x3600000000000000000000000000000000000000": {
    label: "USDC",
    note: "Official USDC on ARC Testnet"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("analyzeBtn").addEventListener("click", handleAnalyze);
  document.getElementById("tokenAddress").addEventListener("keyup", (e) => {
    if (e.key === "Enter") handleAnalyze();
  });

  initThemeToggle();
  initCopy();
  initNetworkSelect();
});

/* -------------------------
   Theme switch (dark/light)
-------------------------- */
function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  const body = document.body;

  btn.addEventListener("click", () => {
    const next = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", next);
    btn.textContent = next === "dark" ? "🌙" : "☀️";
  });
}

/* -------------------------
   Network select (UI only)
-------------------------- */
function initNetworkSelect() {
  const sel = document.getElementById("networkSelect");
  if (!sel) return;

  // Mainnet remains disabled in the UI for now.
  // This keeps the UX ready without changing analysis behavior.
  sel.addEventListener("change", () => {
    if (sel.value !== "arcTestnet") sel.value = "arcTestnet";
  });
}

/* -------------------------
   Copy full contract address
-------------------------- */
function initCopy() {
  const btn = document.getElementById("copyAddressBtn");
  btn.addEventListener("click", async () => {
    const el = document.getElementById("tokenAddressShort");
    const full = el?.dataset.full;
    if (!full) return;

    try {
      await navigator.clipboard.writeText(full);
      btn.textContent = "✔ Copied";
      setTimeout(() => (btn.textContent = "📋 Copy"), 1000);
    } catch {
      btn.textContent = "Error";
      setTimeout(() => (btn.textContent = "📋 Copy"), 1000);
    }
  });
}

/* -------------------------
   Address helpers
-------------------------- */
function isHexAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function shorten(a) {
  if (!a || a.length < 10) return a;
  return a.slice(0, 6) + "..." + a.slice(-4);
}

/* -------------------------
   Contract detection (wallet vs contract)
   - If getCode returns empty (0x / 0x0...) => it's not a contract (wallet/EOA)
   - If the call fails (rate limit / network), we DO NOT block analysis
-------------------------- */
async function getAddressCode(address, networkKey) {
  const explorer = NETWORKS[networkKey].explorerBase;

  const url =
    `${explorer}/api?module=proxy&action=eth_getCode&address=${address}&tag=latest`;

  const res = await fetch(url);
  const json = await res.json();

  const code = (json && typeof json.result === "string") ? json.result : "";
  return code;
}

function isEmptyCode(code) {
  // Matches "0x", "0x0", "0x00", ...
  return /^0x0*$/i.test(code || "");
}

/* -------------------------
   UI: show invalid input message using the risk card
-------------------------- */
function showInputPanel({ pill, title, desc, bullets }) {
  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const statusMsg = document.getElementById("statusMsg");
  const explorerLink = document.getElementById("explorerLink");

  tokenCard.classList.add("hidden");
  riskCard.classList.remove("hidden");

  if (explorerLink) explorerLink.style.display = "none";
  if (statusMsg) statusMsg.textContent = "";

  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");
  const ul = document.querySelector(".risk-notes");

  riskPill.className = "risk-pill risk-warning";
  riskPill.textContent = pill;

  riskTitle.textContent = title;
  riskDesc.textContent = desc;

  ul.innerHTML = "";
  for (const b of bullets) {
    const li = document.createElement("li");
    li.textContent = b;
    ul.appendChild(li);
  }

  // Verified badge off
  document.getElementById("verifiedBadge")?.classList.add("hidden");
}

/* -------------------------
   Validate token-like metadata (reduces false positives)
-------------------------- */
function isTokenMetadataValid(data) {
  if (!data || typeof data !== "object") return false;

  const nameOk = typeof data.name === "string" && data.name.trim().length >= 2;
  const symOk = typeof data.symbol === "string" && data.symbol.trim().length >= 1;

  // decimals may be number or string depending on the endpoint
  const dec = Number(data.decimals);
  const decOk = Number.isFinite(dec) && dec >= 0 && dec <= 255;

  return nameOk && symOk && decOk;
}

/* -------------------------
   Main handler
-------------------------- */
async function handleAnalyze() {
  const input = document.getElementById("tokenAddress").value.trim();
  const addr = input;

  if (!isHexAddress(addr)) {
    alert("Invalid address format. Please paste a 0x... address (40 hex chars).");
    return;
  }

  const networkKey = "arcTestnet"; // UI keeps testnet only for now
  const normalized = addr.toLowerCase();

  const riskCard = document.getElementById("riskCard");
  const tokenCard = document.getElementById("tokenCard");
  const statusMsg = document.getElementById("statusMsg");

  riskCard.classList.add("hidden");
  tokenCard.classList.add("hidden");
  statusMsg.textContent = "Checking address type...";

  // Step 1: If allowlisted, we can skip strict checks (but still fetch token data)
  const isAllowlisted = !!TRUSTED_TOKENS[normalized];

  // Step 2: Try to detect wallet vs contract via eth_getCode (hard signal if it works)
  if (!isAllowlisted) {
    try {
      const code = await getAddressCode(addr, networkKey);

      if (isEmptyCode(code)) {
        showInputPanel({
          pill: "⚠️ Invalid input",
          title: "Wallet address detected.",
          desc: "This tool analyzes ARC-20 token contracts only. Wallet addresses are not supported.",
          bullets: [
            "Please enter a valid ARC-20 contract address.",
            "No token analysis was performed."
          ]
        });
        return;
      }
    } catch (e) {
      // If eth_getCode fails (rate limit, CORS, temporary outage), do not block.
      console.warn("eth_getCode failed, continuing with metadata validation:", e);
    }
  }

  // Step 3: Fetch token metadata from your serverless endpoint
  statusMsg.textContent = "Loading token data from ARC public API...";

  let data;
  try {
    const resp = await fetch(`/api/arc-token?address=${addr}&network=${networkKey}`);
    data = await resp.json();
  } catch (e) {
    console.error(e);
    showInputPanel({
      pill: "⚠️ Error",
      title: "Could not load token data.",
      desc: "The public endpoint did not respond. Please try again.",
      bullets: [
        "If this keeps happening, the API may be rate-limited or temporarily down.",
        "Try again in a moment."
      ]
    });
    return;
  }

  // Step 4: If metadata doesn't look like a token, treat it as non-token contract (NOT wallet)
  if (!isTokenMetadataValid(data)) {
    showInputPanel({
      pill: "⚠️ Invalid input",
      title: "Not an ARC-20 token contract.",
      desc: "A contract may exist at this address, but it doesn't expose standard ARC-20 metadata via the public endpoint.",
      bullets: [
        "If you pasted a wallet address, it will not be analyzable here.",
        "If you pasted a contract, it may be non-ARC-20 or the API can't read its metadata.",
        "Verify the address on the explorer."
      ]
    });

    // Still show explorer link to the address page (token route might not exist)
    const explorerLink = document.getElementById("explorerLink");
    if (explorerLink) {
      explorerLink.href = `${NETWORKS[networkKey].explorerBase}/address/${addr}`;
      explorerLink.textContent = "View on explorer ↗";
      explorerLink.style.display = "inline-flex";
    }

    return;
  }

  // Success: render token + risk
  fillTokenInfo(addr, data, networkKey);
  applyRisk(addr, data, networkKey);

  tokenCard.classList.remove("hidden");
  riskCard.classList.remove("hidden");
  statusMsg.textContent = "Token loaded successfully. Always confirm with the official explorer.";
}

/* -------------------------
   Populate token info card
-------------------------- */
function fillTokenInfo(address, token, networkKey) {
  document.getElementById("tName").textContent = token.name || "-";
  document.getElementById("tSymbol").textContent = token.symbol || "-";
  document.getElementById("tDecimals").textContent = token.decimals ?? "unknown";
  document.getElementById("tSupplyRaw").textContent = token.totalSupply || "-";

  const addrEl = document.getElementById("tokenAddressShort");
  addrEl.textContent = shorten(address);
  addrEl.dataset.full = address;

  document.getElementById("tSupplyHuman").textContent =
    formatSupply(token.totalSupply, token.decimals);

  document.getElementById("tokenTitle").textContent =
    `${token.name || "Token"} (${token.symbol || "?"})`;

  const explorer = NETWORKS[networkKey].explorerBase;

  const explorerLink = document.getElementById("explorerLink");
  explorerLink.href = `${explorer}/token/${address}`;
  explorerLink.textContent = "View on explorer ↗";
  explorerLink.style.display = "inline-flex";

  document.getElementById("tokenAvatar").textContent =
    (token.symbol?.[0] || "?").toUpperCase();
}

/* -------------------------
   Format supply as human-readable
-------------------------- */
function formatSupply(raw, dec) {
  if (!raw) return "-";
  try {
    const big = BigInt(raw);
    const d = BigInt(Number(dec) || 0);
    if (d === 0n) return big.toLocaleString();

    const f = 10n ** d;
    const intPart = big / f;
    const fracPart = big % f;

    const frac = fracPart.toString().padStart(Number(d), "0").slice(0, 4);
    return `${intPart.toLocaleString()}.${frac}`;
  } catch {
    return String(raw);
  }
}

/* ============================================================
   RISK ENGINE (heuristic; does NOT require allowlist)
============================================================ */
function applyRisk(address, token, networkKey) {
  const normalized = address.toLowerCase();
  const trusted = TRUSTED_TOKENS[normalized];

  const riskPill = document.getElementById("riskPill");
  const riskTitle = document.getElementById("riskTitle");
  const riskDesc = document.getElementById("riskDescription");
  const verifiedBadge = document.getElementById("verifiedBadge");

  // reset
  riskPill.className = "risk-pill";
  verifiedBadge.classList.add("hidden");

  const breakdown = [];
  let score = 0;

  // Allowlist shortcut
  if (trusted) {
    riskPill.textContent = "🟢 Trusted";
    riskPill.classList.add("risk-safe");
    verifiedBadge.classList.remove("hidden");

    riskTitle.textContent = `${token.symbol || "Token"} is allowlisted.`;
    riskDesc.textContent = trusted.note + " · Still verify links and metadata.";

    breakdown.push({
      icon: "🟢",
      label: "Trusted list",
      reason: "This contract is explicitly listed as an official asset.",
      add: 0
    });

    renderRiskNotes("safe", score, breakdown);
    return;
  }

  // Decimals
  const decimals = Number(token.decimals);
  let decAdd = 0;
  if (!Number.isFinite(decimals)) decAdd = 2;
  else if (decimals === 0) decAdd = 2;
  else if (decimals > 18) decAdd = 2;

  breakdown.push({
    icon: decAdd ? "⚠️" : "✅",
    label: "Decimals",
    reason: !Number.isFinite(decimals)
      ? "Decimals are missing/invalid."
      : decimals === 0
      ? "Token has 0 decimals — unusual for ERC-20 assets."
      : decimals > 18
      ? "Very high decimals — often used in misleading tokens."
      : "Decimals appear normal.",
    add: decAdd
  });
  score += decAdd;

  // Name / Symbol quality
  const name = (token.name || "").trim();
  const symbol = (token.symbol || "").trim();
  let nsAdd = 0;
  if (name.length < 3) nsAdd += 1;
  if (symbol.length < 2 || symbol.length > 10) nsAdd += 1;

  breakdown.push({
    icon: nsAdd ? "⚠️" : "✅",
    label: "Name / Symbol",
    reason: nsAdd
      ? "Unusual name or symbol length/format."
      : "Name and symbol look well-structured.",
    add: nsAdd
  });
  score += nsAdd;

  // Impersonation (soft warning)
  const famous = ["USDC", "USDT", "ETH", "BTC", "BNB", "ARB", "MATIC"];
  let impAdd = 0;
  if (famous.includes(symbol.toUpperCase())) impAdd = 2;

  breakdown.push({
    icon: impAdd ? "🚩" : "✅",
    label: "Impersonation",
    reason: impAdd
      ? `Symbol matches a well-known asset (${symbol}). Could be impersonation.`
      : "No obvious impersonation indicators.",
    add: impAdd
  });
  score += impAdd;

  // Supply sanity
  let supplyAdd = 0;
  let supply = 0n;
  try { supply = BigInt(token.totalSupply || "0"); } catch { supplyAdd += 2; }

  if (supply === 0n) supplyAdd += 2;
  if (supply > 10n ** 40n) supplyAdd += 2;

  breakdown.push({
    icon: supplyAdd ? "⚠️" : "✅",
    label: "Total supply",
    reason: supplyAdd
      ? (supply === 0n
          ? "Total supply is zero — token may be broken or non-standard."
          : "Supply looks unusual (missing/invalid or extremely large).")
      : "Supply looks normal.",
    add: supplyAdd
  });
  score += supplyAdd;

  // Address pattern (very light)
  let addrAdd = 0;
  if (normalized.startsWith("0x000000")) addrAdd = 1;

  breakdown.push({
    icon: addrAdd ? "⚠️" : "✅",
    label: "Address pattern",
    reason: addrAdd
      ? "Address starts with many zeros — can be vanity or misleading patterns."
      : "Nothing unusual about the address format.",
    add: addrAdd
  });
  score += addrAdd;

  // Testnet limitations (info only)
  breakdown.push({ icon: "ℹ️", label: "Verification", reason: "Verification status is not exposed by this endpoint.", add: 0 });
  breakdown.push({ icon: "ℹ️", label: "Honeypot checks", reason: "Honeypot simulation is not available on testnet.", add: 0 });

  // Score → label
  let level = "safe";
  if (score >= 7) level = "danger";
  else if (score >= 4) level = "warning";
  else if (score >= 1) level = "caution";

  if (level === "safe") {
    riskPill.textContent = "🟢 Likely Safe";
    riskPill.classList.add("risk-safe");
    riskTitle.textContent = "No major red flags detected.";
    riskDesc.textContent = "Token structure looks standard. Still not a safety guarantee.";
  } else if (level === "caution") {
    riskPill.textContent = "⚠️ Caution";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Minor unusual characteristics found.";
    riskDesc.textContent = "Some metadata looks slightly off. Verify carefully.";
  } else if (level === "warning") {
    riskPill.textContent = "⚠️ Risky";
    riskPill.classList.add("risk-warning");
    riskTitle.textContent = "Several red flags detected.";
    riskDesc.textContent = "Interact only if you fully understand the project and risks.";
  } else {
    riskPill.textContent = "🔥 High Risk";
    riskPill.classList.add("risk-danger", "glow-danger");
    riskTitle.textContent = "Severe risk indicators detected.";
    riskDesc.textContent = "Token appears suspicious. Avoid interacting unless verified.";
  }

  renderRiskNotes(level, score, breakdown);
}

function renderRiskNotes(level, totalScore, breakdown) {
  const ul = document.querySelector(".risk-notes");
  if (!ul) return;

  const levelLabel =
    level === "safe" ? "Likely Safe" :
    level === "caution" ? "Caution" :
    level === "warning" ? "Risky" : "High Risk";

  ul.innerHTML = "";

  const header = document.createElement("li");
  header.innerHTML = `<strong>Why this rating? (${levelLabel}, score ${totalScore})</strong>`;
  ul.appendChild(header);

  for (const b of breakdown) {
    const li = document.createElement("li");
    li.innerHTML = `${b.icon} <strong>${b.label}:</strong> ${b.reason}${b.add ? ` (score +${b.add})` : ""}`;
    ul.appendChild(li);
  }

  const li1 = document.createElement("li");
  li1.textContent = "Heuristic only — always verify the contract manually.";
  ul.appendChild(li1);

  const li2 = document.createElement("li");
  li2.textContent = "Read-only analysis. No wallet connection required.";
  ul.appendChild(li2);
}

