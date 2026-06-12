import { AgentIntent, AgentAction } from "@glassvault/shared";

const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions";

/**
 * Sends a natural language prompt to Venice AI to be parsed into a structured AgentIntent.
 * Uses strict system prompts to ensure JSON output.
 *
 * When MOCK_MODE is on (or VENICE_API_KEY is missing), returns a regex-parsed mock intent.
 */
export async function parseIntentWithVenice(
  userPrompt: string,
  supportedChains: { id: number; name: string }[]
): Promise<AgentIntent> {
  const apiKey = process.env.VENICE_API_KEY;
  const mockMode = process.env.MOCK_MODE !== "false";

  // ==========================================
  // REAL MODE: Call Venice AI API
  // ==========================================
  if (!mockMode && apiKey) {
    console.log(`[venice.service] REAL MODE: Calling Venice AI...`);

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
{"action":"transfer","chainId":84532,"fromToken":"USDC","amount":"10","recipient":"0x123...","rawIntent":"Send 10 USDC to 0x123...","confidence":0.99}`;

    try {
      const response = await fetch(VENICE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`Venice API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Venice API returned empty content");
      }

      const parsed = JSON.parse(content) as AgentIntent;
      parsed.rawIntent = userPrompt;
      console.log("[venice.service] Parsed intent:", parsed);
      return parsed;
    } catch (error) {
      console.error("[venice.service] Venice API call failed, falling back to mock:", error);
      // Fall through to mock mode
    }
  }

  // ==========================================
  // MOCK MODE: Regex-based intent parsing
  // ==========================================
  console.log(`[venice.service] (MOCK MODE) Parsing prompt: "${userPrompt}"`);

  let action: AgentAction = "transfer";
  let fromToken = "USDC";
  let toToken: string | undefined;
  let amount = "10";
  let recipient = "0x0000000000000000000000000000000000001234";

  const promptLower = userPrompt.toLowerCase();

  // Detect action
  if (promptLower.includes("swap")) {
    action = "swap";
  } else if (promptLower.includes("portfolio") || promptLower.includes("report") || promptLower.includes("balance")) {
    action = "portfolio_report";
  } else if (promptLower.includes("revoke") || promptLower.includes("cancel")) {
    action = "revoke_permissions";
  }

  // Extract amount (look for numbers)
  const amountMatch = userPrompt.match(/(\d+(?:\.\d+)?)/);
  if (amountMatch) {
    amount = amountMatch[1];
  }

  // Extract token names
  const tokenMatch = userPrompt.match(/\b(USDC|ETH|WETH|DAI|USDT|MON)\b/i);
  if (tokenMatch) {
    fromToken = tokenMatch[1].toUpperCase();
  }

  // For swaps, try to find "for X" or "to X"
  if (action === "swap") {
    const swapToMatch = userPrompt.match(/(?:for|to|into)\s+(\w+)/i);
    if (swapToMatch) {
      toToken = swapToMatch[1].toUpperCase();
    }
  }

  // Extract address (0x...)
  const addressMatch = userPrompt.match(/(0x[a-fA-F0-9]{4,40})/);
  if (addressMatch) {
    recipient = addressMatch[1];
    // Pad short addresses for display
    if (recipient.length < 42) {
      recipient = recipient + "0".repeat(42 - recipient.length);
    }
  }

  const parsed: AgentIntent = {
    action,
    chainId: 84532,
    fromToken,
    toToken,
    amount,
    recipient: action === "transfer" ? recipient : undefined,
    rawIntent: userPrompt,
    confidence: 0.95,
  };

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  console.log("[venice.service] Mock parsed intent:", parsed);
  return parsed;
}
