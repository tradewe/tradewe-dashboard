// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Web3Provider } from "./web3";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Web3Provider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Web3Provider>
  </React.StrictMode>
);