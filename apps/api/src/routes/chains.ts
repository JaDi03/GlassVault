import { Router } from "express";

const router = Router();

// Chains we want to support in the UI
const TARGET_CHAINS = [
  { id: 84532, name: "Base Sepolia" },
  { id: 10143, name: "Monad Testnet" }
];

/**
 * GET /api/chains
 * Calls the 1Shot relayer_getCapabilities endpoint for each supported chain
 * to dynamically fetch supported fee tokens and target addresses.
 */
router.get("/", async (req, res) => {
  try {
    const relayerUrl = process.env.ONESHOT_RELAYER_URL || "https://relayer.1shotapi.com/relayers";
    
    // Fetch capabilities for all target chains in parallel
    const capabilitiesPromises = TARGET_CHAINS.map(async (chain) => {
      try {
        const response = await fetch(relayerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: chain.id,
            method: "relayer_getCapabilities",
            params: [chain.id.toString()]
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // The 1Shot response returns an object mapped by the decimal chainId string
        const chainIdStr = chain.id.toString();
        const caps = result?.result?.[chainIdStr];

        // If the API returns valid caps, use them. Otherwise, if it's a testnet, use a mock so we can test.
        const resolvedCaps = caps ? {
          supportedFeeTokens: caps.tokens?.map((t: any) => t.symbol) || [],
          isGaslessEnabled: true,
          targetAddress: caps.targetAddress
        } : (chain.id === 84532 || chain.id === 10143) ? {
          // TESTNET FALLBACK MOCK
          supportedFeeTokens: ["USDC"],
          isGaslessEnabled: true,
          targetAddress: "0x0000000000000000000000000000000000000000"
        } : null;

        return {
          chainId: chain.id,
          name: chain.name,
          capabilities: resolvedCaps
        };
      } catch (err) {
        console.error(`[chains] Error fetching capabilities for chain ${chain.id}:`, err);
        return {
          chainId: chain.id,
          name: chain.name,
          capabilities: null
        };
      }
    });

    const chainData = await Promise.all(capabilitiesPromises);

    res.json({
      success: true,
      data: chainData
    });
  } catch (error) {
    console.error("[chains] Global error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
