import { AgentIntent } from "@glassvault/shared";
import { encodeFunctionData, parseUnits } from "viem";

/**
 * Standard ERC-20 Transfer ABI
 */
const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

// Token addresses for Base Sepolia
const TOKENS: Record<string, { address: `0x${string}`; decimals: number }> = {
  USDC: { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
};

// 1Shot Relayer constants for Base Sepolia (from relayer_getCapabilities)
const FEE_COLLECTOR = "0xE936e8FAf4A5655469182A49a505055B71C17604" as `0x${string}`;

/**
 * JSON-RPC helper for 1Shot Relayer calls.
 */
export async function relayerRpc<T>(relayerUrl: string, method: string, params: unknown): Promise<T> {
  const payload = { jsonrpc: "2.0", id: Date.now(), method, params };
  console.log(`[oneshot.rpc] ${method} →`, JSON.stringify(params, null, 2));

  const res = await fetch(relayerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();

  if (json.error) {
    throw new Error(`[${json.error.code}] ${json.error.message} ${JSON.stringify(json.error.data ?? "")}`);
  }
  return json.result as T;
}

/**
 * Encodes the user's intent into a raw execution object.
 */
function encodeIntentExecution(intent: AgentIntent): { target: `0x${string}`; value: string; data: `0x${string}` } {
  if (intent.action === "transfer") {
    if (!intent.recipient) throw new Error("Recipient is required for transfer");
    if (!intent.amount) throw new Error("Amount is required for transfer");
    if (!intent.fromToken) throw new Error("Token is required for transfer");

    const token = TOKENS[intent.fromToken];

    // ETH Transfer (native)
    if (!token || intent.fromToken === "ETH") {
      return {
        target: intent.recipient as `0x${string}`,
        value: parseUnits(intent.amount, 18).toString(),
        data: "0x",
      };
    }

    // ERC-20 Transfer
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [intent.recipient as `0x${string}`, parseUnits(intent.amount, token.decimals)],
    });

    return {
      target: token.address,
      value: "0",
      data,
    };
  }

  throw new Error(`Execution for action "${intent.action}" is not supported yet`);
}

/**
 * Select the correct 1Shot relayer endpoint based on chain ID.
 * Testnets → .dev, Mainnets → .com (per SKILL.md line 23-25)
 */
export function relayerUrlForChain(chainId: number): string {
  return chainId === 84532 || chainId === 11155111
    ? "https://relayer.1shotapi.dev/relayers"
    : "https://relayer.1shotapi.com/relayers";
}

// --- Estimate result type (from SKILL.md schemas) ---
interface Estimate7710Result {
  success: boolean;
  requiredPaymentAmount?: string;
  context?: string;
  gasUsed: Record<string, string>;
  error?: string;
}

/**
 * Uses 1Shot Relayer to execute a delegated transaction (EIP-7710).
 *
 * Full flow per SKILL.md:
 *   1. Build mock fee execution + work execution
 *   2. Call relayer_estimate7710Transaction to validate & get requiredPaymentAmount + context
 *   3. If fee differs from mock, rebuild and re-estimate
 *   4. Call relayer_send7710Transaction with context from estimate
 *   5. Poll relayer_getStatus until terminal state
 */
export async function executeVia1ShotRelayer(
  buildChainCallback: (feeAmount: bigint) => Promise<any[]>,
  intent: AgentIntent,
  authorizationList?: any[]
) {
  const relayerUrl = relayerUrlForChain(intent.chainId);
  const workExecution = encodeIntentExecution(intent);
  const usdcToken = TOKENS.USDC;

  console.log(`[oneshot] Executing via 1Shot Relayer on chain ${intent.chainId}...`);
  console.log(`[oneshot] Relayer URL: ${relayerUrl}`);

  // Step 1: Build mock fee execution (≥ minFee, which is ~$0.01 = 10000 atoms for USDC)
  // Using 0.01 USDC as the initial mock fee per SKILL.md recommendation
  let feeAmount = 10000n; // 0.01 USDC (6 decimals)

  function buildFeeExecution(amount: bigint) {
    return {
      target: usdcToken.address,
      value: "0",
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [FEE_COLLECTOR, amount],
      }),
    };
  }

  function buildSendParams(currentFeeAmount: bigint, chain: any[]) {
    const params: any = {
      chainId: intent.chainId.toString(),
      transactions: [
        {
          permissionContext: chain,
          executions: [
            buildFeeExecution(currentFeeAmount),
            workExecution,
          ],
        },
      ],
    };
    if (authorizationList && authorizationList.length > 0) {
      params.authorizationList = authorizationList;
    }
    return params;
  }

  // Step 2: Estimate the transaction fee
  console.log("[oneshot] Step 2: Estimating transaction fee...");
  let currentChain = await buildChainCallback(feeAmount);
  let sendParams = buildSendParams(feeAmount, currentChain);

  let estimate: Estimate7710Result;
  try {
    estimate = await relayerRpc<Estimate7710Result>(
      relayerUrl,
      "relayer_estimate7710Transaction",
      sendParams
    );
  } catch (err: any) {
    console.error("[oneshot] Estimate RPC error:", err.message);
    throw new Error(`Fee estimation failed: ${err.message}`, { cause: err });
  }

  if (!estimate.success) {
    throw new Error(`Fee estimation rejected: ${estimate.error || "Unknown error"}`);
  }

  console.log(`[oneshot] Estimate success! Required fee: ${estimate.requiredPaymentAmount} atoms, gas: ${JSON.stringify(estimate.gasUsed)}`);

  // Step 3: If required fee differs from mock, rebuild with correct fee
  const requiredFee = BigInt(estimate.requiredPaymentAmount || "10000");
  if (requiredFee !== feeAmount) {
    console.log(`[oneshot] Adjusting fee from ${feeAmount} to ${requiredFee} atoms...`);
    feeAmount = requiredFee;
    currentChain = await buildChainCallback(feeAmount);
    sendParams = buildSendParams(feeAmount, currentChain);

    // Re-estimate with corrected fee (the context from first estimate is now stale)
    estimate = await relayerRpc<Estimate7710Result>(
      relayerUrl,
      "relayer_estimate7710Transaction",
      sendParams
    );
    if (!estimate.success) {
      throw new Error(`Re-estimation rejected: ${estimate.error || "Unknown error"}`);
    }
    console.log(`[oneshot] Re-estimate success! Context locked.`);
  }

  // Step 4: Submit with price-lock context from estimate
  console.log("[oneshot] Step 4: Submitting transaction...");
  const webhookUrl = process.env.WEBHOOK_URL || "";
  const taskId = await relayerRpc<string>(
    relayerUrl,
    "relayer_send7710Transaction",
    {
      ...sendParams,
      context: estimate.context,
      memo: "glassvault",
      ...(webhookUrl ? { destinationUrl: webhookUrl } : {})
    }
  );

  console.log(`[oneshot] Task submitted! ID: ${taskId}`);

  // Step 5: Webhook handles status updates
  if (webhookUrl) {
    console.log(`[oneshot] Step 5: Waiting for 1Shot Webhook at ${webhookUrl} to confirm task ${taskId}.`);
    return {
      success: true,
      txHash: taskId,
      taskId,
      status: "processing",
      message: "Transaction submitted to 1Shot. Awaiting Webhook confirmation.",
    };
  } else {
    console.warn("[oneshot] No WEBHOOK_URL defined. We will not receive real-time updates for task", taskId);
    return {
      success: true,
      txHash: taskId,
      taskId,
      status: "processing",
      message: "Transaction submitted but no webhook is configured for updates.",
    };
  }
}
