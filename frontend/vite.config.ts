import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "SwachhSetu",
        short_name: "SwachhSetu",
        description: "Verified public sanitation for Godavari Pushkaralu 2027 (prototype)",
        theme_color: "#0E5E6F",
        background_color: "#F6F8F7",
        display: "standalone",
        start_url: "/w",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/docs/],
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
    }),
  ],
  server: { host: true, port: 5173, proxy: { "/api": "http://localhost:8000" } },
});
