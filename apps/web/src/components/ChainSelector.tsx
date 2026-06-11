import { useState, useEffect } from "react";
import { SupportedChainId } from "@glassvault/shared";
import { supportedChainsList } from "../lib/chains";

interface ChainSelectorProps {
  selectedChainId: SupportedChainId;
  onSelect: (chainId: SupportedChainId) => void;
}

export function ChainSelector({ selectedChainId, onSelect }: ChainSelectorProps) {
  const [capabilities, setCapabilities] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch 1Shot capabilities from our backend
    fetch("/api/chains")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const capsMap: Record<number, any> = {};
          data.data.forEach((chain: any) => {
            capsMap[chain.chainId] = chain.capabilities;
          });
          setCapabilities(capsMap);
        }
      })
      .catch((err) => console.error("Failed to load chain capabilities", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="chain-selector">
      <h3 className="chain-selector-title">Select Network</h3>
      <div className="chain-options">
        {supportedChainsList.map((chain) => {
          const isSelected = chain.id === selectedChainId;
          const caps = capabilities[chain.id];

          return (
            <button
              key={chain.id}
              className={`chain-option ${isSelected ? "selected" : ""}`}
              onClick={() => onSelect(chain.id)}
            >
              <div className="chain-info">
                <span className="chain-name">{chain.name}</span>
                {loading ? (
                  <span className="chain-badge loading">Loading...</span>
                ) : caps?.isGaslessEnabled ? (
                  <span className="chain-badge gasless">Gasless (1Shot)</span>
                ) : (
                  <span className="chain-badge unsupported">Not Supported</span>
                )}
              </div>
              {!loading && caps?.supportedFeeTokens && (
                <div className="chain-fees">
                  Fee Tokens: {caps.supportedFeeTokens.join(", ")}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
