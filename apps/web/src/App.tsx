import { useState } from "react";
import { ChainSelector } from "./components/ChainSelector";
import { SupportedChainId } from "@glassvault/shared";

/**
 * GlassVault - Root Application Component
 *
 * This is the application shell. Feature components will be composed here
 * as each feature phase is implemented.
 */
function App() {
  const [selectedChainId, setSelectedChainId] = useState<SupportedChainId>(84532);

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
        <div className="scaffold-notice">
          <h1>Phase 2 Active</h1>
          <p>Network config loaded from backend.</p>
          <ChainSelector 
            selectedChainId={selectedChainId} 
            onSelect={setSelectedChainId} 
          />
        </div>
      </main>
    </div>
  );
}

export default App;
