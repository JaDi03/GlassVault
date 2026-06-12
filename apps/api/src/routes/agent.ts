import { Router } from "express";
import { parseIntentWithVenice } from "../lib/venice";

const router = Router();

// Current target chains for the Venice context
const TARGET_CHAINS = [
  { id: 84532, name: "Base Sepolia" },
  { id: 10143, name: "Monad Testnet" }
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

export default router;
