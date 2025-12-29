import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: "./client",
  server: {
    host: "::",
    port: process.env.PORT ? parseInt(process.env.PORT) : 8082,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      allow: ["./", "../shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "../server/**"],
    },
  },
  build: {
    outDir: "../dist/spa",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
}));
