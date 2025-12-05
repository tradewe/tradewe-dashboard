// src/web3.tsx
import { ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, bsc } from "@reown/appkit/networks";

// Ten sam projectId co wcześniej z Reown / WalletConnect
const projectId = "4ee72678b22db76d9841a7762b09f1ed";

// Metadata dApp – jak miałeś do tej pory
const metadata = {
  name: "TradeWe Presale",
  description: "TradeWe TWE presale dashboard",
  url: "https://tradewe.io",
  icons: ["https://i.ibb.co/HDGcZBJ9/rsz-logowe.png"],
};

// Obsługiwane chainy
const networks = [mainnet, bsc];

// Adapter wagmi dla AppKit
const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
});

// Konfiguracja wagmi wyciągnięta z adaptera – używamy w providerze
export const wagmiConfig = wagmiAdapter.wagmiConfig;

// 🚫 Tu naprawdę wyłączamy email + social loginy
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: bsc, // możesz dać mainnet, jeśli wolisz
  metadata,
  themeMode: "dark",
  features: {
    analytics: true,   // możesz zostawić
    email: false,      // ❌ wyłączony email-login
    socials: false,    // ❌ wyłączone wszystkie social loginy
    onramp: false,     // jak nie chcesz "Buy crypto"
    swaps: false,      // jak nie chcesz wbudowanych swapów
    send: false,
  },
});

// Provider jak wcześniej – App.tsx / wagmi hooki zostają te same
export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      {children}
    </WagmiProvider>
  );
}