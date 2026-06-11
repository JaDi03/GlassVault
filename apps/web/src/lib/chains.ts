import { ChainConfig, SupportedChainId } from "@glassvault/shared";

/**
 * Hardcoded initial configuration for supported networks.
 * In a production environment, this could be fetched entirely from the backend.
 */
export const SUPPORTED_CHAINS: Record<SupportedChainId, ChainConfig> = {
  84532: {
    id: 84532,
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    blockExplorerUrl: "https://sepolia.basescan.org",
    nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
  },
  10143: {
    id: 10143,
    name: "Monad Testnet",
    rpcUrl: "https://testnet-rpc.monad.xyz",
    blockExplorerUrl: "https://testnet.monadexplorer.com",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  },
};

/**
 * Array of supported chains for rendering in the UI.
 */
export const supportedChainsList = Object.values(SUPPORTED_CHAINS);
