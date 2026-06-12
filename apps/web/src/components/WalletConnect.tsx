import { useState, useEffect } from "react";
import { SupportedChainId } from "@glassvault/shared";
import { DelegationPanel } from "./DelegationPanel";
import { grantAgentPermissions } from "../lib/delegation";
// Note: We will import from @metamask/smart-accounts-kit once we build the session flow.

interface WalletConnectProps {
  selectedChainId: SupportedChainId;
  onConnect: (address: string | null) => void;
  activeSession: { limit: number, expireDays: number, context?: any } | null;
  setActiveSession: (session: { limit: number, expireDays: number, context?: any } | null) => void;
}

export function WalletConnect({ selectedChainId, onConnect, activeSession, setActiveSession }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDelegating, setIsDelegating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = typeof window !== "undefined" && Boolean((window as any).ethereum);

  const disconnectWallet = async () => {
    try {
      if (window.ethereum) {
        await (window as any).ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }]
        });
      }
    } catch (err) {
      console.error("Failed to revoke MetaMask permissions:", err);
    } finally {
      setAddress(null);
      setActiveSession(null);
      onConnect(null);
    }
  };

  const handleDelegate = async (spendLimit: number, expireDays: number) => {
    setIsDelegating(true);
    try {
      console.log(`Requesting real EIP-7715 session key on chain ${selectedChainId}...`);
      
      const permissionsContext = await grantAgentPermissions(spendLimit, expireDays, selectedChainId);
      console.log("Delegation context received:", permissionsContext);
      
      setActiveSession({ limit: spendLimit, expireDays, context: permissionsContext });
    } catch (err: any) {
      console.error("Delegation failed", err);
      setError(err?.message || "Failed to grant session key.");
    } finally {
      setIsDelegating(false);
    }
  };

  const revokeSession = async () => {
    try {
      // TODO: Implement actual EIP-7715 wallet_revokePermissions
      setActiveSession(null);
    } catch (err) {
      console.error("Revoke failed", err);
    }
  };

  const connectWallet = async () => {
    if (!isMetaMaskInstalled) {
      setError("Please install MetaMask to use GlassVault.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // 1. Request account access
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts && accounts.length > 0) {
        const userAddress = accounts[0];
        setAddress(userAddress);
        onConnect(userAddress);

        // 2. Ensure the wallet is on the correct chain (EIP-3326)
        const hexChainId = `0x${selectedChainId.toString(16)}`;
        try {
          await (window as any).ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: hexChainId }],
          });
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask.
          // In a full production app, we would call wallet_addEthereumChain here.
          if (switchError.code === 4902) {
            setError(`Please add chain ${selectedChainId} to your MetaMask manually.`);
          } else {
            console.error("Failed to switch chain:", switchError);
          }
        }
      }
    } catch (err: any) {
      console.error("Connection failed:", err);
      setError(err.message || "Failed to connect to wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="wallet-connect">
      {address ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="connected-status" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="wallet-address">
              Connected: {address.slice(0, 6)}...{address.slice(-4)}
            </span>
            <span className="smart-account-badge">EIP-7715 Ready</span>
            <button 
              onClick={disconnectWallet} 
              title="Disconnect"
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center',
                padding: '4px'
              }}
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#ef4444" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
          
          {activeSession ? (
            <div className="delegation-panel" style={{ border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ color: '#10b981' }}>Active Session Key</h3>
                  <p>Agent is authorized and ready.</p>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  ACTIVE
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>Spend Limit</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>${activeSession.limit} USDC</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>Time Remaining</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>{activeSession.expireDays} Days</div>
                </div>
              </div>
              <button 
                onClick={revokeSession}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  color: '#ef4444',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Revoke Session Key
              </button>
            </div>
          ) : (
            <DelegationPanel 
              onDelegate={handleDelegate} 
              isDelegating={isDelegating} 
            />
          )}
        </div>
      ) : (
        <div className="connect-prompt">
          <button 
            className="premium-connect-btn" 
            onClick={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <span className="loader-spinner"></span>
            ) : (
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" 
                alt="MetaMask" 
                className="metamask-logo"
                width="28" 
                height="28"
              />
            )}
            {isConnecting ? "Conectando..." : "Connect MetaMask"}
          </button>
          {error && <p className="error-text">{error}</p>}
        </div>
      )}
    </div>
  );
}
