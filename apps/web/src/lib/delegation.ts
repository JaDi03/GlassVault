import { SupportedChainId } from "@glassvault/shared";
import { createWalletClient, custom, createPublicClient, http, parseUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { bytesToHex } from "viem/utils";
import { erc7715ProviderActions } from "@metamask/smart-accounts-kit/actions";
import { decodeDelegations } from "@metamask/smart-accounts-kit/utils";

// --- 1Shot Relayer constants for Base Sepolia (from relayer_getCapabilities) ---
const RELAYER_TARGET_ADDRESS = "0xf1ef956eff4181Ce913b664713515996858B9Ca9" as `0x${string}`;
const USDC_TOKEN_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
const USDC_DECIMALS = 6;

/**
 * Convert delegation bigints / Uint8Arrays into JSON-safe shapes.
 * Copied from the public-relayer skill (examples.md).
 */
function toRelayerJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  if (value instanceof Uint8Array) return bytesToHex(value);
  if (Array.isArray(value)) return value.map(toRelayerJson);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toRelayerJson(v);
    return out;
  }
  return value;
}

/**
 * Grants the 1Shot Relayer a scoped delegation to act on behalf of the user's EOA.
 * Uses @metamask/smart-accounts-kit with EIP-7715 (wallet_requestExecutionPermissions).
 * This is the required flow for browser extensions like MetaMask.
 */
export async function grantAgentPermissions(
  spendLimit: number,
  expiryDays: number,
  chainId: SupportedChainId
) {
  if (!window.ethereum) throw new Error("MetaMask is not installed.");

  // Get the connected user's address
  const accounts = await (window as any).ethereum.request({
    method: "eth_accounts",
  });
  const userAddress = accounts?.[0] as `0x${string}` | undefined;
  if (!userAddress) throw new Error("No wallet connected.");

  const chain = chainId === 84532 ? baseSepolia : baseSepolia;
  
  // Create wallet client and extend with EIP-7715 actions
  const walletClient = createWalletClient({
    account: userAddress,
    chain,
    transport: custom(window.ethereum),
  });
  const wallet7715 = walletClient.extend(erc7715ProviderActions());

  console.log(`[delegation] Relayer target: ${RELAYER_TARGET_ADDRESS}`);
  console.log(`[delegation] User EOA: ${userAddress}`);
  console.log(`[delegation] Requesting EIP-7715 execution permissions...`);

  const maxAmount = parseUnits(spendLimit.toString(), USDC_DECIMALS);
  const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryDays * 86400);

  // Request permission from the extension
  // Note: For browser extensions, EIP-7702 upgrades and EIP-7715 permissions
  // are handled internally by the wallet when this method is called.
  const granted = await wallet7715.requestExecutionPermissions([
    {
      chainId: chain.id,
      to: RELAYER_TARGET_ADDRESS,
      permission: {
        type: "erc20-token-periodic",
        data: {
          tokenAddress: USDC_TOKEN_ADDRESS,
          periodAmount: maxAmount,
          periodDuration: expiryDays * 86400,
          justification: "Allow GlassVault Agent to execute automated transfers via 1Shot Relayer",
        },
        isAdjustmentAllowed: true,
      },
      expiry: expiryTimestamp,
    },
  ]);

  const context = granted[0]?.context;
  if (!context) throw new Error("No permission context returned by wallet");

  // Decode the context into a delegations array and serialize it for the relayer
  const delegations = decodeDelegations(context).map((d) => toRelayerJson(d));
  
  console.log("[delegation] Delegation granted and serialized!", delegations);

  return {
    grantedAt: Date.now(),
    spendLimit,
    expiryDays,
    chainId,
    userAddress,
    delegation: delegations, // The array of delegations
    // Authorization list is handled by the wallet extension implicitly via 7715
    authorizationList: undefined, 
  };
}
