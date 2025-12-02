// src/ConnectWalletButton.tsx
import { useAccount } from "wagmi";
import { useWeb3Modal } from "@web3modal/wagmi/react";

function shortenAddress(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const { open } = useWeb3Modal();

  const label = isConnected && address
    ? shortenAddress(address)
    : "Connect wallet";

  const handleClick = () => {
    if (isConnected) {
      // otwiera ładny widok "Account" z disconnect / network / itp.
      open({ view: "Account" });
    } else {
      // standardowy modal z wyborem portfela (ikony, WalletConnect itd.)
      open();
    }
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