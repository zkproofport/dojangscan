import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.DOJANGSCAN_PROXY_TARGET || "http://127.0.0.1:18094";
  const url = new URL(target);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "DOJANGSCAN_PROXY_TARGET must be a credential-free loopback SSH tunnel",
    );
  return {
    plugins: [react()],
    base: "./",
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    server: {
      host: "127.0.0.1",
      port: 4317,
      strictPort: true,
      proxy: {
        "/api/historical": {
          target: "http://127.0.0.1:18096",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/historical/, ""),
        },
        "/api/dojangscan": {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/dojangscan/, ""),
        },
      },
    },
  };
});
