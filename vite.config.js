/* global process */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import backend from "./scripts/vite-backend-plugin.mjs";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

// The frontend calls /api on its own origin and Vite forwards it to the Go
// server, so no CORS is needed in development.
const proxy = { "/api": { target: BACKEND_URL, changeOrigin: true } };

export default defineConfig({
  // Starting the frontend also starts the Go backend (see the plugin file)
  plugins: [react(), backend({ url: BACKEND_URL })],
  server: { proxy },
  preview: { proxy },
  build: {
    rollupOptions: {
      output: {
        // Keep the PDF library out of the main bundle
        manualChunks: { pdf: ["jspdf", "jspdf-autotable"] },
      },
    },
  },
});
