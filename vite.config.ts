import { defineConfig, loadEnv, type ProxyOptions } from "vite";
import production from "./deployment/public-explorer.json";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode, command }) => {
  const env = command === "serve" ? loadEnv(mode, process.cwd(), "") : {};
  const publicAPI =
    mode === "public-readonly" || env.DOJANGSCAN_PUBLIC_API_PROXY === "1";
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
    ...(mode === "public-readonly"
      ? {
          define: {
            "import.meta.env.VITE_DOJANGSCAN_NETWORK": JSON.stringify(
              production.network,
            ),
          },
        }
      : {}),
    base: "./",
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    server: {
      host: "127.0.0.1",
      port: 4317,
      strictPort: true,
      proxy: {
        ...(mode === 'public-readonly' ? {
          '^/api/public-explorer/api/v2/': {
            target: 'https://sepolia-explorer.giwa.io',
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api\/public-explorer/, ''),
            configure: (proxy) => {
              proxy.on('proxyReq', (req) => { req.removeHeader('origin'); req.removeHeader('cookie'); req.removeHeader('authorization'); });
            },
            bypass: (req) => req.method === 'GET' ? undefined : false,
          } satisfies ProxyOptions,
        } : {}),
        "/api/recent": {
          target: publicAPI
            ? "https://api.dojangscan.com"
            : "http://127.0.0.1:18098",
          ...(publicAPI
            ? { headers: { Origin: "https://dojangscan.com" } }
            : {}),
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/api\/recent/, publicAPI ? "/recent" : ""),
        },
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
