import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode, command }) => {
  const env = command === "serve" ? loadEnv(mode, process.cwd(), "") : {};
  const publicAPI = env.DOJANGSCAN_PUBLIC_API_PROXY === "1";
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
          target: publicAPI
            ? "https://api.dojangscan.com"
            : "http://127.0.0.1:18096",
          ...(publicAPI
            ? { headers: { Origin: "https://dojangscan.com" } }
            : {}),
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/api\/historical/, publicAPI ? "/history" : ""),
        },
        "/api/dojangscan": {
          target: publicAPI ? "https://api.dojangscan.com" : target,
          ...(publicAPI
            ? { headers: { Origin: "https://dojangscan.com" } }
            : {}),
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/api\/dojangscan/, publicAPI ? "/live" : ""),
        },
      },
    },
  };
});
