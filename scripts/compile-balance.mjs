import { execFileSync } from "node:child_process";
import { copyFileSync } from "node:fs";
const executable = process.env.DOJANG_NARGO || "nargo";
const version = execFileSync(executable, ["--version"], { encoding: "utf8" });
if (!version.includes("nargo version = 1.0.0-beta.8"))
  throw new Error(
    "Use nargo 1.0.0-beta.8. Set DOJANG_NARGO to that binary path.",
  );
execFileSync(executable, ["compile"], {
  cwd: "zk/offchain-balance",
  stdio: "inherit",
});
copyFileSync(
  "zk/offchain-balance/target/offchain_balance.json",
  "public/zk/offchain_balance.json",
);
console.log(
  "Compiled Noir beta.8 circuit. Regenerate/test the Solidity key with npm run test:zk.",
);
