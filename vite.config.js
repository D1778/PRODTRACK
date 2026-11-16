/* global process */
import { createLogger, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import backend from "./scripts/vite-backend-plugin.mjs";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

// The frontend calls /api on its own origin and Vite forwards it to the Go
// server, so no CORS is needed in development.
//
// The Go backend needs a few seconds after Vite to build and reach MongoDB. A page
// that is already open asks for data in that gap, so instead of printing a stack
// trace for every request, answer 503 "starting" (the app retries on its own) and
// print one short line.
const logger = createLogger();
const logError = logger.error;
logger.error = (msg, options) => {
  // Vite prints a stack trace for every proxied request that fails; our handler below says it once
  if (typeof msg === "string" && msg.includes("http proxy error")) return;
  logError(msg, options);
};

const proxy = {
  "/api": {
    target: BACKEND_URL,
    changeOrigin: true,
    configure: (p) => {
      let warned = false;
      p.on("error", (_err, _req, res) => {
        if (!warned) {
          warned = true;
          console.log("\x1b[34m[api]\x1b[0m The backend isn't answering yet (it is probably still starting). Requests work as soon as it is up.");
        }
        if (res && typeof res.writeHead === "function" && !res.headersSent) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "The backend is starting. Please try again in a moment." }));
        }
      });
      p.on("proxyRes", () => { warned = false; }); // say it again if the backend goes down later
    },
  },
};

export default defineConfig({
  customLogger: logger,
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
