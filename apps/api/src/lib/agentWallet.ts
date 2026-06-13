import { privateKeyToAccount, PrivateKeyAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Returns the Viem account for the Chat Agent (Parser).
 * This account receives the initial delegation from the user.
 */
export function getChatAgentAccount(): PrivateKeyAccount {
  const pk = process.env.AGENT_CHAT_PRIVATE_KEY;
  if (!pk || !pk.startsWith("0x")) {
    throw new Error("AGENT_CHAT_PRIVATE_KEY is missing or invalid in environment.");
  }
  return privateKeyToAccount(pk as `0x${string}`);
}

/**
 * Returns the public address of the Chat Agent.
 */
export function getAgentAddress(): string {
  return getChatAgentAccount().address;
}

/**
 * Returns the Viem account for the Security Agent (Firewall).
 * This account receives the JIT redelegation and authorizes the relayer.
 */
export function getSecurityAgentAccount(): PrivateKeyAccount {
  const pk = process.env.AGENT_SECURITY_PRIVATE_KEY;
  if (!pk || !pk.startsWith("0x")) {
    throw new Error("AGENT_SECURITY_PRIVATE_KEY is missing or invalid in environment.");
  }
  return privateKeyToAccount(pk as `0x${string}`);
}
