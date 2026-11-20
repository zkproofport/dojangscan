// Explicit public-only configuration; never ingest local VITE_* credentials.
import fs from "node:fs";
import { build } from "vite";
const p = JSON.parse(fs.readFileSync(new URL("../deployment/public-explorer.json", import.meta.url)));
if (p.defaultSource !== "public" || p.liveAPIBase !== "https://api.dojangscan.com/live" || p.historicalAPIBase !== "https://api.dojangscan.com/history" || p.network !== "giwa-sepolia-catchup25-r1") throw new Error("UNREVIEWED_PUBLIC_SETTINGS");
for (const name of Object.keys(process.env)) if (name.startsWith("VITE_")) delete process.env[name];
Object.assign(process.env, {
  VITE_DOJANGSCAN_API_BASE: p.liveAPIBase,
  VITE_DOJANGSCAN_HISTORY_API_BASE: p.historicalAPIBase,
  VITE_DOJANGSCAN_NETWORK: p.network,
});
await build({ envDir: false, build: { outDir: "dist-public", emptyOutDir: true } });
