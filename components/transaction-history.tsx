import { useState } from "react";
import { tr } from "@/lib/i18n";
import { NETWORK, short } from "@/lib/giwa";
import {
  recordTransaction,
  useTransactionHistory,
} from "@/lib/transaction-history";
import { refreshReceipt, explainError } from "@/lib/transactions";
import { Badge } from "./scan-ui";
export function TransactionHistory() {
  const entries = useTransactionHistory();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  if (!entries.length) return null;
  return (
    <details className="explain-detail">
      <summary>
        {tr("최근 실행")} · {entries.length}
      </summary>
      <p className="fine-print">
        {tr(
          "이 탭의 공개 tx hash와 결과만 보관합니다. 화면·지갑을 바꿔도 제출한 거래를 다시 확인할 수 있습니다.",
        )}
      </p>
      {entries.map((tx) => (
        <div className="capability-row" key={tx.hash}>
          <strong>{tx.operation}</strong>
          <Badge
            variant={
              tx.status === "confirmed"
                ? "success"
                : tx.status === "failed"
                  ? "danger"
                  : "neutral"
            }
          >
            {tr(
              tx.status === "confirmed"
                ? "확정"
                : tx.status === "failed"
                  ? "실패"
                  : "확인 대기",
            )}
          </Badge>
          <a
            target="_blank"
            rel="noreferrer"
            href={`${NETWORK.explorer}/tx/${tx.hash}`}
          >
            {short(tx.hash, 12)} ↗
          </a>
          <button
            className="text-button"
            disabled={!!busy}
            onClick={() => {
              setBusy(tx.hash);
              setError("");
              void refreshReceipt(tx.hash)
                .then((r) => recordTransaction(tx.operation, r))
                .catch((e) => setError(explainError(e)))
                .finally(() => setBusy(""));
            }}
          >
            {tr("영수증 새로고침")}
          </button>
        </div>
      ))}
      {error && <p className="notice danger">{tr(error)}</p>}
    </details>
  );
}
