// src/widget-entry.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Web3Provider } from "./web3";
import { PresaleWidget } from "./PresaleWidget";

function mountTradeWeWidget(elementId: string) {
  const container = document.getElementById(elementId);
  if (!container) {
    console.warn("[TradeWeWidget] Container not found:", elementId);
    return;
  }

  const queryClient = new QueryClient();

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <Web3Provider>
        <QueryClientProvider client={queryClient}>
          <PresaleWidget />
        </QueryClientProvider>
      </Web3Provider>
    </React.StrictMode>
  );
}

// ⬇⬇⬇ kluczowy side-effect – dzięki temu Vite nie wytnie pliku
if (typeof window !== "undefined") {
  (window as any).TradeWeWidget = {
    mount: mountTradeWeWidget,
  };

  console.log("[TradeWeWidget] global mount available");
}