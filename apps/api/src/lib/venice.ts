import { AgentIntent, AgentAction } from "@glassvault/shared";

const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";

/**
 * Sends a natural language prompt to Venice AI to be parsed into a structured AgentIntent.
 * Uses strict system prompts to ensure JSON output.
 */
export async function parseIntentWithVenice(
  userPrompt: string,
  supportedChains: { id: number; name: string }[]
): Promise<AgentIntent> {
  const apiKey = process.env.VENICE_API_KEY;
  // In MOCK MODE we bypass this check so the frontend can test without a real key
  // if (!apiKey) {
  //   throw new Error("VENICE_API_KEY is not configured.");
  // }

  const systemPrompt = `You are the brain of GlassVault, a Web3 financial agent.
Your job is to parse the user's natural language request into a strict JSON object representing an on-chain intent.

Valid actions: "transfer", "swap", "lp_deposit", "portfolio_report", "revoke_permissions"
Supported chains: ${JSON.stringify(supportedChains)}

You MUST respond with ONLY a valid JSON object matching this TypeScript interface. No markdown, no backticks, no explanations.
interface AgentIntent {
  action: string;
  chainId: number;
  fromToken?: string;
  toToken?: string;
  amount?: string;
  recipient?: string;
  slippageBps?: number;
  rawIntent: string; // the original user prompt
  confidence: number; // 0.0 to 1.0
}

Example output:
{"action":"transfer","chainId":8453,"fromToken":"USDC","amount":"10","recipient":"0x123...","rawIntent":"Send 10 USDC to 0x123...","confidence":0.99}`;

  try {
    // ==========================================
    // MOCK MODE: To save Venice AI API credits during development,
    // we bypass the actual API call and return a hardcoded/regex-based intent.
    // We will re-enable the real API in the final phase.
    // ==========================================
    
    console.log(`[venice.service] (MOCK MODE) Parsing prompt: "${userPrompt}"`);
    
    // Simple regex to extract an amount and recipient for testing
    let action: AgentAction = "transfer";
    const amount = "10";
    const recipient = "0x0000000000000000000000000000000000001234";

    if (userPrompt.toLowerCase().includes("swap")) {
      action = "swap";
    }

    // Mock parsed intent
    const parsed: AgentIntent = {
      action,
      chainId: 84532, // Defaulting to Base Sepolia testnet
      fromToken: "USDC",
      amount,
      recipient,
      rawIntent: userPrompt,
      confidence: 0.99
    };

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    return parsed;
  } catch (error) {
    console.error("[venice.service] Failed to parse intent:", error);
    throw new Error("Failed to parse your request into a valid action.", { cause: error });
  }
}
