import { useState } from "react";
import { ChainSelector } from "./components/ChainSelector";
import { WalletConnect } from "./components/WalletConnect";
import { AgentChat } from "./components/AgentChat";
import { SupportedChainId } from "@glassvault/shared";

/**
 * GlassVault - Root Application Component
 *
 * This is the application shell. Feature components will be composed here
 * as each feature phase is implemented.
 */
function App() {
  const [selectedChainId, setSelectedChainId] = useState<SupportedChainId>(84532);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{ limit: number, expireDays: number, context?: any } | null>(null);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo-mark">
          <span className="logo-icon">🔐</span>
          <span className="logo-text">GlassVault</span>
        </div>
        <p className="tagline">Your personal on-chain finance agent</p>
      </header>
      <main className="app-main">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', width: '100%', maxWidth: '1600px', margin: '0 auto', padding: '0 2rem' }}>
          
          <div className="scaffold-notice" style={{ maxWidth: '100%' }}>
            <h1>Phase 4 Active</h1>
            <p>MetaMask Smart Accounts EIP-7715 Integration.</p>
            <ChainSelector 
              selectedChainId={selectedChainId} 
              onSelect={setSelectedChainId} 
            />
            <div style={{ marginTop: '2rem' }}>
              <WalletConnect 
                selectedChainId={selectedChainId}
                onConnect={setUserAddress}
                activeSession={activeSession}
                setActiveSession={setActiveSession}
              />
            </div>
          </div>

          <div className="chat-section">
            <AgentChat activeSession={activeSession} />
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;
