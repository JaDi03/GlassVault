import { useState, useRef, useEffect } from "react";
import { AgentIntent } from "@glassvault/shared";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  intent?: AgentIntent;
  txHash?: string;
  status?: "parsing" | "awaiting_confirm" | "executing" | "confirmed" | "failed";
}

interface AgentChatProps {
  activeSession: { limit: number; expireDays: number; context?: any } | null;
}

export function AgentChat({ activeSession }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      text: "Hello! I'm your GlassVault Agent. Connect your wallet and grant me a session key, then tell me what you'd like to do.\n\nTry: \"Send 10 USDC to 0x1234...\" or \"Swap 5 USDC for ETH\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<AgentIntent | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (msg: Omit<Message, "id">) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  };

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  };

  /**
   * Step 1: Parse the user's intent via Venice AI
   */
  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input.trim();
    setInput("");

    addMessage({ role: "user", text: userText });
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userText }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        const intent = data.data as AgentIntent;
        setPendingIntent(intent);

        addMessage({
          role: "agent",
          text: formatIntentSummary(intent),
          intent,
          status: "awaiting_confirm",
        });
      } else {
        throw new Error(data.error || "Unknown parse error");
      }
    } catch (err: any) {
      addMessage({
        role: "agent",
        text: `❌ Failed to parse your request: ${err.message}`,
        status: "failed",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Step 2: User confirms → execute via backend
   */
  const handleConfirmExecute = async () => {
    if (!pendingIntent) return;

    const intent = pendingIntent;
    setPendingIntent(null);

    if (!activeSession?.context) {
      addMessage({
        role: "agent",
        text: "⚠️ You need to grant a session key first. Use the delegation panel on the left to authorize the agent.",
        status: "failed",
      });
      return;
    }

    const execMsgId = addMessage({
      role: "agent",
      text: `⏳ Executing ${intent.action}...`,
      status: "executing",
    });

    try {
      const execRes = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedDelegations: activeSession.context.delegation,
          authorizationList: activeSession.context.authorizationList,
          intent,
        }),
      });

      const execData = await execRes.json();

      if (execData.success) {
        const isConfirmed = execData.status === "confirmed";
        updateMessage(execMsgId, {
          text: isConfirmed
            ? `✅ Transaction confirmed!\n\nTx Hash: ${execData.txHash}\n${execData.message || ""}`
            : `⏳ ${execData.message || "Transaction submitted, awaiting confirmation..."}\n\nTask ID: ${execData.taskId || execData.txHash}`,
          txHash: execData.txHash,
          status: isConfirmed ? "confirmed" : "executing",
        });
      } else {
        throw new Error(execData.error || "Execution failed");
      }
    } catch (err: any) {
      updateMessage(execMsgId, {
        text: `❌ Execution failed: ${err.message}`,
        status: "failed",
      });
    }
  };

  const handleRejectIntent = () => {
    setPendingIntent(null);
    addMessage({
      role: "agent",
      text: "👍 Cancelled. What else would you like to do?",
    });
  };

  return (
    <div className="agent-chat-container">
      <div className="chat-header">
        <div className="agent-avatar">🤖</div>
        <div>
          <h3 style={{ margin: 0 }}>GlassVault AI</h3>
          <span style={{ fontSize: "0.8rem", color: "#10b981" }}>
            ● Online {activeSession ? "(Session Active)" : "(No Session)"}
          </span>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className={`message-bubble ${msg.status || ""}`}>
              <p style={{ whiteSpace: "pre-wrap" }}>{msg.text}</p>

              {/* Intent Confirmation Card */}
              {msg.intent && msg.status === "awaiting_confirm" && pendingIntent && (
                <div className="intent-card">
                  <h4>📋 Transaction Details</h4>
                  <div className="intent-details">
                    <div className="intent-row">
                      <span className="intent-label">Action</span>
                      <span className="intent-value">{msg.intent.action.toUpperCase()}</span>
                    </div>
                    <div className="intent-row">
                      <span className="intent-label">Amount</span>
                      <span className="intent-value">{msg.intent.amount || "—"} {msg.intent.fromToken || ""}</span>
                    </div>
                    {msg.intent.toToken && (
                      <div className="intent-row">
                        <span className="intent-label">To Token</span>
                        <span className="intent-value">{msg.intent.toToken}</span>
                      </div>
                    )}
                    {msg.intent.recipient && (
                      <div className="intent-row">
                        <span className="intent-label">Recipient</span>
                        <span className="intent-value" style={{ fontSize: "0.75rem" }}>
                          {msg.intent.recipient}
                        </span>
                      </div>
                    )}
                    <div className="intent-row">
                      <span className="intent-label">Chain</span>
                      <span className="intent-value">{msg.intent.chainId === 84532 ? "Base Sepolia" : "Monad Testnet"}</span>
                    </div>
                    <div className="intent-row">
                      <span className="intent-label">Confidence</span>
                      <span className="intent-value">{(msg.intent.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="intent-actions">
                    <button className="btn-confirm" onClick={handleConfirmExecute}>
                      ✅ Confirm & Execute
                    </button>
                    <button className="btn-reject" onClick={handleRejectIntent}>
                      ❌ Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Completed intent (no longer pending) */}
              {msg.intent && msg.status !== "awaiting_confirm" && (
                <div className="intent-card compact">
                  <div className="intent-row">
                    <span className="intent-label">Action</span>
                    <span className="intent-value">{msg.intent.action.toUpperCase()}</span>
                  </div>
                  <div className="intent-row">
                    <span className="intent-label">Amount</span>
                    <span className="intent-value">{msg.intent.amount || "—"} {msg.intent.fromToken || ""}</span>
                  </div>
                </div>
              )}

              {/* Tx Hash link */}
              {msg.txHash && (
                <div className="tx-hash-display">
                  <span className="tx-label">TxHash:</span>
                  <code>{msg.txHash.slice(0, 10)}...{msg.txHash.slice(-8)}</code>
                </div>
              )}

              {/* Status indicator */}
              {msg.status === "executing" && (
                <div className="executing-indicator">
                  <span className="loader-spinner" />
                  <span>Processing on-chain...</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-message agent">
            <div className="message-bubble typing-indicator">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={activeSession ? "e.g. Send 10 USDC to 0x1234..." : "Connect wallet & grant session first..."}
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading || !input.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Formats the parsed intent into a human-readable summary.
 */
function formatIntentSummary(intent: AgentIntent): string {
  switch (intent.action) {
    case "transfer":
      return `I understood you want to **transfer ${intent.amount || "?"} ${intent.fromToken || "tokens"}** to \`${intent.recipient || "unknown"}\` on ${intent.chainId === 84532 ? "Base Sepolia" : "Monad Testnet"}.\n\nPlease confirm below to execute:`;
    case "swap":
      return `I understood you want to **swap ${intent.amount || "?"} ${intent.fromToken || "?"} → ${intent.toToken || "?"}** on ${intent.chainId === 84532 ? "Base Sepolia" : "Monad Testnet"}.\n\nPlease confirm below to execute:`;
    case "portfolio_report":
      return `I'll generate a **portfolio report** for your wallet.\n\nPlease confirm:`;
    default:
      return `I parsed your intent as: **${intent.action}**.\n\nPlease confirm below:`;
  }
}
