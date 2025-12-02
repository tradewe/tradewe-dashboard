// src/web3.tsx
import { ReactNode } from "react";
import { mainnet, bsc } from "wagmi/chains";
import { WagmiProvider } from "wagmi";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { defaultWagmiConfig } from "@web3modal/wagmi";

// Twój WalletConnect Project ID
const projectId = "4ee72678b22db76d9841a7762b09f1ed";

// Dane dApp
const metadata = {
  name: "TradeWe Presale",
  description: "TradeWe TWE presale dashboard",
  url: "https://tradewe.io",
  icons: ["https://i.ibb.co/HDGcZBJ9/rsz-logowe.png"],
};

// Obsługiwane chainy
const chains = [mainnet, bsc];

// ⚡ Profesjonalna konfiguracja bez social loginów
export const wagmiConfig = defaultWagmiConfig({
  projectId,
  chains,
  metadata,

  // REALNE portfele
  enableWalletConnect: true,
  enableInjected: true, // MetaMask / Rabby / Trust jeśli obsługiwane
  enableCoinbase: true,

  // ❌ Wyłączamy wszystkie social / cloud wallets
  enableEmail: false,
  enableAdmin: false,
  enableSms: false,
  enableFarcaster: false,
  enableSafe: false,
  enableLedger: false,
  autoConnect: true
});

// Web3Modal
createWeb3Modal({
  wagmiConfig,
  projectId,
  chains,
  themeMode: "dark",
  features: {
    email: false,
    socials: [],       // <--- najważniejsze, usuwa Discord/Google/Apple
  },
  themeVariables: {
    "--w3m-accent": "#22c55e",
    "--w3m-border-radius-master": "16px",
  },
});

// Provider
export function Web3Provider({ children }: { children: ReactNode }) {
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}