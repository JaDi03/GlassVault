/**
 * GlassVault - Root Application Component
 *
 * This is the application shell. Feature components will be composed here
 * as each feature phase is implemented.
 */
function App() {
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
          <h1>Scaffold Complete</h1>
          <p>Phase 1 complete. Feature components will be wired here in subsequent phases.</p>
          <ul>
            <li>Phase 2: Chain config + 1Shot capability discovery</li>
            <li>Phase 3: Venice AI intent parsing</li>
            <li>Phase 4: MetaMask Smart Account connection</li>
            <li>Phase 5: Agent loop + relay execution</li>
            <li>Phase 6: x402 + redelegation</li>
            <li>Phase 7: Webhooks + real-time feed</li>
            <li>Phase 8: UI polish + receipt display</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

export default App;
