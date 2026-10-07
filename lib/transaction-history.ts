import { useSyncExternalStore } from "react";
import type { TransactionResult } from "./transactions";
export type HistoryEntry = TransactionResult & {
  operation: string;
  submittedAt: number;
};
const key = "dojangscan-transaction-history";
let entries: HistoryEntry[] = [];
const listeners = new Set<() => void>();
if (typeof sessionStorage !== "undefined") {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || "[]");
    if (Array.isArray(parsed))
      entries = parsed
        .filter(
          (e) =>
            /^0x[0-9a-f]{64}$/i.test(e.hash) &&
            typeof e.operation === "string" &&
            Array.isArray(e.uids),
        )
        .slice(0, 20);
  } catch {}
}
export function recordTransaction(
  operation: string,
  result: TransactionResult,
) {
  const existing = entries.find((e) => e.hash === result.hash);
  entries = [
    { ...result, operation, submittedAt: existing?.submittedAt || Date.now() },
    ...entries.filter((e) => e.hash !== result.hash),
  ].slice(0, 20);
  try {
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(
        key,
        JSON.stringify(
          entries.map(
            ({ hash, status, uids, operation, submittedAt, block }) => ({
              hash,
              status,
              uids,
              operation,
              submittedAt,
              block,
            }),
          ),
        ),
      );
  } catch {}
  listeners.forEach((fn) => fn());
}
export function useTransactionHistory() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => entries,
    () => entries,
  );
}
