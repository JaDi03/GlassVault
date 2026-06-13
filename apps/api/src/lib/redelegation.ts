/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// NOTE: This file uses @metamask/smart-accounts-kit which has a type-level
// conflict with the root viem version (dual viem instance issue). The runtime
// behavior is correct — this directive only suppresses incompatible type
// declarations from the bundled ox/viem inside smart-accounts-kit.
import { AgentIntent } from "@glassvault/shared";
import { getChatAgentAccount, getSecurityAgentAccount } from "./agentWallet";
import { toMetaMaskSmartAccount, Implementation, createDelegation, ScopeType } from "@metamask/smart-accounts-kit";
import { parseUnits, createPublicClient, http, bytesToHex } from "viem";
import { randomBytes } from "crypto";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL_BASE_SEPOLIA || "https://sepolia.base.org"),
});

const RELAYER_TARGET_ADDRESS = "0xf1ef956eff4181Ce913b664713515996858B9Ca9" as `0x${string}`;
const USDC_TOKEN_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;

/**
 * Generates a random salt to prevent delegation signature collisions.
 */
function generateSalt(): `0x${string}` {
  return bytesToHex(Uint8Array.from(randomBytes(32)));
}

/**
 * Convert delegation bigints / Uint8Arrays into JSON-safe shapes.
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
 * Builds the Just-In-Time (JIT) redelegation chain
 * 1. Root: User -> Chat Agent (received from frontend)
 * 2. Redelegation 1: Chat Agent -> Security Agent (JIT exact amount)
 * 3. Redelegation 2: Security Agent -> 1Shot Relayer (JIT exact amount)
 */
export async function buildRedelegationChain(
  rootDelegations: any[],
  intent: AgentIntent,
  requiredFeeAmount: bigint
): Promise<any[]> {
  const chatAccount = getChatAgentAccount();
  const securityAccount = getSecurityAgentAccount();

  // Cast to any: resolves type conflict between root viem and the viem
  // bundled inside @metamask/smart-accounts-kit (two incompatible versions).
  const chatSmartAccount = await toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Stateless7702,
    address: chatAccount.address,
    signer: { account: chatAccount },
  });

  const securitySmartAccount = await toMetaMaskSmartAccount({
    client: publicClient as any,
    implementation: Implementation.Stateless7702,
    address: securityAccount.address,
    signer: { account: securityAccount },
  });

  const rootDelegation = rootDelegations[0];
  if (!rootDelegation) throw new Error("No root delegation provided from Frontend");

  // Calculate JIT exact amount (Transfer + Estimated relayer gas fee)
  // Note: If intent.amount does not exist (e.g., revoke), parseUnits would fail.
  // We assume action === "transfer" for the JIT scope in this Hackathon context.
  const transferAmount = (intent.action === "transfer" && intent.amount) ? parseUnits(intent.amount, 6) : 0n;
  const exactMaxAmount = transferAmount + requiredFeeAmount;

  console.log(`[Redelegation] Building JIT chain for exact amount: ${exactMaxAmount} atoms`);

  // ==========================================
  // Redelegation 1: Chat -> Security
  // ==========================================
  const redelegation1Unsigned = createDelegation({
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: USDC_TOKEN_ADDRESS,
      maxAmount: exactMaxAmount
    },
    to: securityAccount.address,
    from: chatAccount.address,
    parentDelegation: rootDelegation,
    environment: chatSmartAccount.environment,
    salt: generateSalt(),
  });

  const sig1 = await chatSmartAccount.signDelegation({ delegation: redelegation1Unsigned });
  const redelegation1 = { ...redelegation1Unsigned, signature: sig1 };

  // ==========================================
  // Redelegation 2: Security -> 1Shot Relayer
  // ==========================================
  const redelegation2Unsigned = createDelegation({
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: USDC_TOKEN_ADDRESS,
      maxAmount: exactMaxAmount
    },
    to: RELAYER_TARGET_ADDRESS,
    from: securityAccount.address,
    parentDelegation: redelegation1,
    environment: securitySmartAccount.environment,
    salt: generateSalt(),
  });

  const sig2 = await securitySmartAccount.signDelegation({ delegation: redelegation2Unsigned });
  const redelegation2 = { ...redelegation2Unsigned, signature: sig2 };

  // Return the exact array that 1Shot requires: reversed order [Redel2, Redel1, Root]
  // The first delegation's delegate MUST be the Relayer.
  return [
    toRelayerJson(redelegation2),
    toRelayerJson(redelegation1),
    rootDelegation
  ];
}
