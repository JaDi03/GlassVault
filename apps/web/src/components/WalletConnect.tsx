import { useState, useEffect } from "react";
import { SupportedChainId } from "@glassvault/shared";
// Note: We will import from @metamask/delegation-toolkit once we build the session flow.

interface WalletConnectProps {
  selectedChainId: SupportedChainId;
  onConnect: (address: string | null) => void;
}

export function WalletConnect({ selectedChainId, onConnect }: WalletConnectProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = typeof window !== "undefined" && Boolean((window as any).ethereum);

  const disconnectWallet = () => {
    setAddress(null);
    onConnect(null);
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
