// src/ConnectWalletButton.tsx
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";

function shortenAddress(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function ConnectWalletButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  const label =
    isConnected && address ? shortenAddress(address) : "Connect wallet";

  const handleClick = () => {
    // to samo zachowanie co wcześniej:
    // jeśli nie połączony -> otwórz modal,
    // jeśli połączony -> otwórz widok konta
    open({ view: isConnected ? "Account" : "Connect" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: isConnected
          ? "1px solid rgba(148,163,184,0.7)"
          : "none",
        background: isConnected
          ? "transparent"
          : "linear-gradient(90deg,#22c55e,#a3e635)",
        color: isConnected ? "white" : "#020617",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}