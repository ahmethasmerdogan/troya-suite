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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Çekirdek satıcı (react/router/query) sabit bir chunk → deploy'lar arası cache isabeti.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|@tanstack|zustand)[\\/]/.test(id)) {
            return "vendor";
          }
          // 3D yığını yalnız tanıtım sayfasının sahneleri yükler.
          if (/[\\/]node_modules[\\/](three|three-stdlib|@react-three|troika-[^\\/]+|camera-controls|maath)[\\/]/.test(id)) {
            return "three";
          }
        },
      },
    },
  },
});
