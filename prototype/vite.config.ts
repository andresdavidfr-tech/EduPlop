import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar React y la criptografía del código de la app: un cambio de
          // UI no invalida la caché de estas dependencias estables.
          "vendor-react": ["react", "react-dom"],
          "vendor-crypto": ["@noble/curves", "@noble/hashes"],
        },
      },
    },
  },
});
