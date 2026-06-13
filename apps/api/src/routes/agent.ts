import { Router } from "express";
import { parseIntentWithVenice } from "../lib/venice";
import { getAgentAddress } from "../lib/agentWallet";
import { executeVia1ShotRelayer } from "../lib/oneshot";
import { SecurityFirewall } from "../lib/securityAgent";
import { buildRedelegationChain } from "../lib/redelegation";

const router = Router();

// Current target chains for the Venice context
const TARGET_CHAINS = [
  { id: 84532, name: "Base Sepolia" }
];

/**
 * POST /api/agent/parse
 * Accepts a natural language string and returns a structured AgentIntent.
 */
router.post("/parse", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid prompt string." });
    }

    const intent = await parseIntentWithVenice(prompt, TARGET_CHAINS);

    res.json({
      success: true,
      data: intent
    });
  } catch (error: any) {
    console.error("[agent/parse] Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/address
 * Returns the public address of the Agent wallet, derived from AGENT_PRIVATE_KEY.
 */
router.get("/address", (_req, res) => {
  try {
    const address = getAgentAddress();
    console.log(`[agent/address] Agent wallet address: ${address}`);
    res.json({ success: true, address });
  } catch (error: any) {
    // Fallback for when AGENT_PRIVATE_KEY is not set
    console.warn("[agent/address] Could not derive agent address:", error.message);
    res.json({
      success: true,
      address: "0x0000000000000000000000000000000000000001",
      warning: "AGENT_PRIVATE_KEY not configured — using placeholder address"
    });
  }
});

/**
 * POST /api/agent/execute
 * Accepts a signedDelegation, optional authorizationList, and AgentIntent,
 * then executes the transaction via the 1Shot Relayer.
 * 100% REAL Execution. No simulations.
 */
router.post("/execute", async (req, res) => {
  try {
    const { signedDelegations, authorizationList, intent } = req.body;

    if (!intent) {
      return res.status(400).json({ success: false, error: "Missing intent" });
    }
    if (!signedDelegations) {
      return res.status(400).json({ success: false, error: "Missing signedDelegations from MetaMask" });
    }

    console.log("[agent/execute] --- REAL Execution Request ---");
    console.log(`[agent/execute] Action: ${intent.action}`);
    console.log(`[agent/execute] Chain: ${intent.chainId}`);

    // ==============================================================
    // STEP 1: SECURITY FIREWALL
    // ==============================================================
    console.log("[agent/execute] Validating intent in Security Firewall...");
    // intent.rawIntent contains the original user prompt
    const securityCheck = await SecurityFirewall.validatePromptSecurity(intent.rawIntent, intent);
    
    if (!securityCheck.safe) {
      console.warn(`[agent/execute] ❌ TRANSACTION BLOCKED BY FIREWALL: ${securityCheck.reason}`);
      return res.status(403).json({ 
        success: false, 
        error: "Blocked by Security Agent",
        reason: securityCheck.reason
      });
    }
    console.log("[agent/execute] ✅ Firewall passed. Preparing execution.");

    if (authorizationList) {
      console.log(`[agent/execute] Authorization list entries: ${authorizationList.length}`);
    }

    // ==============================================================
    // STEP 2: EXECUTION WITH DYNAMIC JIT REDELEGATION
    // ==============================================================
    // We pass a callback to oneshot.ts so it can rebuild the chain
    // if the gas estimate changes, ensuring the amount is always exact JIT.
    const buildChainCb = async (feeAmount: bigint) => {
      return await buildRedelegationChain(signedDelegations, intent, feeAmount);
    };

    // Execute via 1Shot Relayer (estimate → send → poll)
    const result = await executeVia1ShotRelayer(buildChainCb, intent, authorizationList);

    // Forward the REAL status from the relayer
    return res.json({
      success: result.success,
      taskId: result.taskId,
      txHash: result.txHash,
      status: result.status,
      message: result.message || (result.status === "confirmed"
        ? "Transaction confirmed on-chain!"
        : "Transaction submitted, awaiting confirmation..."),
    });

  } catch (error: any) {
    console.error("[agent/execute] Execution Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
