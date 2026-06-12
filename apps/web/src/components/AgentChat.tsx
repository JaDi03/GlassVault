import { useState, useRef, useEffect } from "react";
import { AgentIntent } from "@glassvault/shared";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
  intent?: AgentIntent;
}

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: "welcome", 
      role: "agent", 
      text: "Hello! I am your GlassVault Agent. Connect your wallet and grant me a session key, then tell me what you'd like to do (e.g. 'Swap 10 USDC for ETH')." 
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userText = input.trim();
    setInput("");
    
    // Add user message
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, role: "user", text: userText }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userText })
      });

      const data = await response.json();
      
      if (data.success && data.data) {
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(), 
          role: "agent", 
          text: `I understood you want to perform a **${data.data.action.toUpperCase()}**.`,
          intent: data.data
        }]);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: "agent", 
        text: `Sorry, I couldn't process that: ${err.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="agent-chat-container">
      <div className="chat-header">
        <div className="agent-avatar">🤖</div>
        <div>
          <h3 style={{ margin: 0 }}>GlassVault AI</h3>
          <span style={{ fontSize: '0.8rem', color: '#10b981' }}>● Online (Venice Mock)</span>
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className="message-bubble">
              <p>{msg.text}</p>
              {msg.intent && (
                <div className="intent-card">
                  <h4>Proposed Transaction</h4>
                  <pre>{JSON.stringify(msg.intent, null, 2)}</pre>
                  <button className="execute-btn" disabled>
                    Sign & Execute (Requires Session)
                  </button>
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
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="e.g. Send 10 USDC..."
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading || !input.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
}
