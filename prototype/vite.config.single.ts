import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Build autocontenido: todo (JS + CSS) inlineado en un único index.html
// que se puede abrir directamente con doble clic (file://), sin servidor.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: "dist-single", assetsInlineLimit: 100_000_000 },
});
