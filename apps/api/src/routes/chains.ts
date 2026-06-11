import { Router } from "express";

const router = Router();

/**
 * GET /api/chains
 * Returns the configured chains and their 1Shot relayer capabilities.
 * In a full production scenario, this endpoint would make a real-time
 * JSON-RPC call (relayer_getCapabilities) to the 1Shot relayer URL
 * to dynamically fetch supported tokens and target addresses.
 */
router.get("/", async (req, res) => {
  const baseSepoliaWallet = process.env.ONESHOT_WALLET_BASE_SEPOLIA;
  const monadWallet = process.env.ONESHOT_WALLET_MONAD;

  res.json({
    success: true,
    data: [
      {
        chainId: 84532,
        name: "Base Sepolia",
        serverWallet: baseSepoliaWallet || "0x0000000000000000000000000000000000000000",
        // Simulated capabilities response from 1Shot
        capabilities: {
          supportedFeeTokens: ["USDC"],
          isGaslessEnabled: true,
        },
      },
      {
        chainId: 10143,
        name: "Monad Testnet",
        serverWallet: monadWallet || "0x0000000000000000000000000000000000000000",
        capabilities: {
          supportedFeeTokens: ["MON"],
          isGaslessEnabled: true,
        },
      },
    ],
  });
});

export default router;
