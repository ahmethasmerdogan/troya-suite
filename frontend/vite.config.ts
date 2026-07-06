import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // three.js (Cabin3D) zaten lazy ayrı chunk; uyarı eşiğini ona göre yükselt.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Çekirdek satıcı (react/router/query) sabit bir chunk → deploy'lar arası cache isabeti.
        // three/@react-three KASITEN dışarıda: lazy Cabin3D chunk'ında kalsın (2D yol bedel ödemez).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("three") || id.includes("@react-three")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|@tanstack|zustand)[\\/]/.test(id)) {
            return "vendor";
          }
        },
      },
    },
  },
});
