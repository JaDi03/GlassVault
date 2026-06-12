import { useState } from "react";

interface DelegationPanelProps {
  onDelegate: (spendLimit: number, expireDays: number) => void;
  isDelegating: boolean;
}

export function DelegationPanel({ onDelegate, isDelegating }: DelegationPanelProps) {
  const [spendLimit, setSpendLimit] = useState<number>(50);
  const [expireDays, setExpireDays] = useState<number>(1);

  return (
    <div className="delegation-panel">
      <div className="panel-header">
        <h3>Agent Session Key</h3>
        <p>Set the boundaries for your autonomous agent.</p>
      </div>

      <div className="config-group">
        <div className="config-label-row">
          <label>Max Spend Limit (USDC)</label>
          <span className="config-value">${spendLimit}</span>
        </div>
        <input 
          type="range" 
          min="5" 
          max="500" 
          step="5" 
          value={spendLimit} 
          onChange={(e) => setSpendLimit(Number(e.target.value))}
          className="premium-slider"
        />
        <div className="slider-marks">
          <span>$5</span>
          <span>$500</span>
        </div>
      </div>

      <div className="config-group">
        <div className="config-label-row">
          <label>Session Expiration</label>
          <span className="config-value">{expireDays} Day{expireDays > 1 ? 's' : ''}</span>
        </div>
        <input 
          type="range" 
          min="1" 
          max="30" 
          step="1" 
          value={expireDays} 
          onChange={(e) => setExpireDays(Number(e.target.value))}
          className="premium-slider"
        />
        <div className="slider-marks">
          <span>24h</span>
          <span>30d</span>
        </div>
      </div>

      <div className="policy-summary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        <span>
          Agent can only interact with verified contracts up to <strong>${spendLimit} USDC</strong>. 
          Session auto-revokes in <strong>{expireDays} day{expireDays > 1 ? 's' : ''}</strong>.
        </span>
      </div>

      <button 
        className="premium-delegate-btn"
        onClick={() => onDelegate(spendLimit, expireDays)}
        disabled={isDelegating}
      >
        {isDelegating ? "Signing Transaction..." : "Grant Session Key (EIP-7715)"}
      </button>
    </div>
  );
}
