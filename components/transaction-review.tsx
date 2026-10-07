import { recordTransaction } from "@/lib/transaction-history";
import { useState } from "react";
import { tr } from "@/lib/i18n";
import { NETWORK, short } from "@/lib/giwa";
import {
  executeCall,
  refreshReceipt,
  explainError,
  type TransactionResult,
} from "@/lib/transactions";
import { simulateCall, type PreparedCall } from "@/lib/workspace";
import { downloadJSON } from "./scan-detail";
import { Badge } from "./scan-ui";
export function TransactionReview({
  call,
  address,
  chain,
  onConfirmed,
}: {
  call: PreparedCall;
  address: string;
  chain: number;
  onConfirmed?: (r: TransactionResult) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [simulation, setSimulation] = useState(""),
    [tx, setTx] = useState<TransactionResult | null>(null);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="transaction-review">
      <Badge variant="purple">{tr("실제 계약 호출")}</Badge>
      <h3>{call.operation}</h3>
      <dl className="result-facts">
        <div>
          <dt>{tr("네트워크")}</dt>
          <dd>GIWA Sepolia · {call.chainId}</dd>
        </div>
        <div>
          <dt>{tr("보내는 지갑")}</dt>
          <dd>
            <code>{address || tr("지갑 연결 필요")}</code>
          </dd>
        </div>
        <div>
          <dt>{tr("대상 계약")}</dt>
          <dd>
            <code>{call.to}</code>
          </dd>
        </div>
        <div>
          <dt>ETH</dt>
          <dd>{BigInt(call.value).toString()} wei</dd>
        </div>
      </dl>
      <p className="fine-print">
        {tr(
          "지갑에서 승인하면 실제 트랜잭션이 전송되고 테스트 ETH 가스를 사용합니다.",
        )}
      </p>
      <div className="example-actions">
        <button
          className="secondary-button"
          disabled={busy || !address}
          onClick={() =>
            void run(async () => {
              const result = await simulateCall(call, address);
              setSimulation(tr("시뮬레이션 통과") + " · " + result.block);
            })
          }
        >
          {tr("시뮬레이션")}
        </button>
        <button
          className="primary"
          disabled={
            busy ||
            !address ||
            chain !== NETWORK.chainId ||
            tx?.status === "pending" ||
            tx?.status === "confirmed"
          }
          onClick={() =>
            void run(async () => {
              setSimulation("");
              const result = await executeCall(call, address, (pending) => {
                setTx(pending);
                recordTransaction(call.operation, pending);
              });
              setTx(result);
              recordTransaction(call.operation, result);
              if (result.status === "confirmed") onConfirmed?.(result);
            })
          }
        >
          {tr(busy ? "처리 중" : "지갑으로 실행")}
        </button>
      </div>
      {chain !== NETWORK.chainId && address && (
        <p className="notice">
          {tr("지갑 네트워크를 GIWA Sepolia로 변경하세요.")}
        </p>
      )}
      {simulation && <p className="notice">{simulation}</p>}
      {tx && (
        <div className="receipt-result">
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
            href={`${NETWORK.explorer}/tx/${tx.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            {short(tx.hash, 12)} ↗
          </a>
          {tx.block && (
            <p>
              {tr("블록")} {tx.block}
            </p>
          )}
          {tx.uids.map((uid) => (
            <a key={uid} href={`?view=explore&uid=${uid}`}>
              UID {short(uid, 12)} ↗
            </a>
          ))}
          {tx.error && <p className="notice danger">{tx.error}</p>}
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result = await refreshReceipt(tx.hash);
                setTx(result);
                recordTransaction(call.operation, result);
                if (result.status === "confirmed") onConfirmed?.(result);
              })
            }
          >
            {tr("영수증 새로고침")}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="notice danger">
          {tr(error)}
        </p>
      )}
      <details className="explain-detail">
        <summary>{tr("calldata / JSON")}</summary>
        <pre className="code-box">{JSON.stringify(call, null, 2)}</pre>
        <button
          className="text-button"
          onClick={() => downloadJSON(call, "contract-call.json")}
        >
          {tr("호출 JSON 저장")}
        </button>
      </details>
    </div>
  );
}
