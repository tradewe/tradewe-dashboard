// vite.widget.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // zamiast lib mode – robimy custom entry jak normalna apka
    rollupOptions: {
      input: "src/widget-entry.tsx",
      output: {
        format: "iife",
        entryFileNames: "tradewe-widget.iife.js",
        name: "TradeWeWidget",
      },
      treeshake: false, // nic nie wycinaj
    },
    minify: true,      // możesz dać false, jeśli chcesz podejrzeć kod
  },
});