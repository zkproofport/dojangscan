import { useMemo, useState } from "react";
import { FunctionFragment, ZeroHash } from "ethers";
import { CONTRACTS } from "@/lib/giwa";
import { tr } from "@/lib/i18n";
import { BOOK_ABI, type PreparedCall } from "@/lib/workspace";
import {
  consoleInterface,
  fetchVerifiedABI,
  prepareConsole,
  readConsole,
} from "@/lib/contract-console";
import { explainError } from "@/lib/transactions";
import { TransactionReview } from "./transaction-review";
import { ChainLoading } from "./chain-loading";
import { Field } from "./workspace";
const defaultABI = JSON.stringify(BOOK_ABI, null, 2);
export default function ContractConsole({
  address,
  chain,
}: {
  address: string;
  chain: number;
}) {
  const [target, setTarget] = useState<string>(CONTRACTS.DojangAttesterBook),
    [abi, setABI] = useState(defaultABI),
    [selected, setSelected] = useState("hasRole(bytes32,address)"),
    [args, setArgs] = useState<string[]>([ZeroHash, address]),
    [value, setValue] = useState("0"),
    [error, setError] = useState(""),
    [result, setResult] = useState(""),
    [call, setCall] = useState<PreparedCall | null>(null),
    [busy, setBusy] = useState(false);
  const parsed = useMemo(() => {
    try {
      return consoleInterface(abi);
    } catch {
      return null;
    }
  }, [abi]);
  const functions =
    parsed?.fragments.filter(
      (f): f is FunctionFragment => f.type === "function",
    ) || [];
  const fn = (() => {
    try {
      return parsed?.getFunction(selected);
    } catch {
      return null;
    }
  })();
  const read = fn && ["view", "pure"].includes(fn.stateMutability);
  const reset = () => {
    setCall(null);
    setResult("");
    setError("");
  };
  async function run(task: () => Promise<void>) {
    setBusy(true);
    reset();
    try {
      await task();
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {busy && <ChainLoading title="컨트랙트 정보를 확인하고 있습니다." />}
      <fieldset className="read-fieldset" disabled={busy}>
        <div className="studio-grid">
          <div className="studio-panel">
            <h3>{tr("Contract Console")}</h3>
            <p>
              {tr(
                "실제 GIWA Sepolia 컨트랙트를 호출합니다. 발행자·관리자 화면에 없는 함수는 여기서 실행할 수 있습니다.",
              )}
            </p>
            <label className="input-label">
              {tr("계약 선택")}
              <select
                className="form-input"
                value={
                  Object.entries(CONTRACTS).find(
                    ([, v]) => v.toLowerCase() === target.toLowerCase(),
                  )?.[0] || ""
                }
                onChange={(e) => {
                  setTarget(
                    CONTRACTS[e.target.value as keyof typeof CONTRACTS] || "",
                  );
                  setABI("[]");
                  setSelected("");
                  setArgs([]);
                  reset();
                }}
              >
                <option value="">{tr("직접 입력")}</option>
                {Object.keys(CONTRACTS).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <Field
              label={tr("대상 계약")}
              value={target}
              setValue={(v) => {
                setTarget(v);
                setABI("[]");
                setSelected("");
                setArgs([]);
                reset();
              }}
            />
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await fetchVerifiedABI(target);
                  const encoded = JSON.stringify(result, null, 2);
                  const parsed = consoleInterface(encoded);
                  const first = parsed.fragments.find(
                    (f) => f.type === "function",
                  ) as FunctionFragment | undefined;
                  setABI(encoded);
                  setSelected(first?.format("sighash") || "");
                  setArgs([]);
                })
              }
            >
              {tr("검증된 ABI 불러오기")}
            </button>
            <details className="explain-detail">
              <summary>ABI JSON</summary>
              <textarea
                aria-label="ABI JSON"
                className="json-input"
                value={abi}
                onChange={(e) => {
                  setABI(e.target.value);
                  reset();
                }}
              />
            </details>
            {!parsed && (
              <p className="notice danger">{tr("ABI JSON을 확인하세요.")}</p>
            )}
            <label className="input-label">
              {tr("함수")}
              <select
                className="form-input"
                value={selected}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setArgs([]);
                  reset();
                }}
              >
                {functions.map((f) => (
                  <option key={f.format("sighash")} value={f.format("sighash")}>
                    {f.stateMutability} · {f.format("sighash")}
                  </option>
                ))}
              </select>
            </label>
            {fn?.inputs.map((p, i) => (
              <Field
                key={selected + i}
                label={`${p.name || "arg" + i} (${p.type})`}
                value={args[i] || ""}
                setValue={(v) => {
                  setArgs((old) => {
                    const a = [...old];
                    a[i] = v;
                    return a;
                  });
                  reset();
                }}
              />
            ))}
            {fn?.payable && (
              <Field
                label="msg.value (wei)"
                value={value}
                setValue={(v) => {
                  setValue(v);
                  reset();
                }}
              />
            )}
            <p className="fine-print">
              {tr("배열·tuple은 JSON, bool은 true 또는 false로 입력합니다.")}
            </p>
            <button
              className="primary"
              disabled={busy || !parsed || !fn}
              onClick={() =>
                void run(async () => {
                  const prepared = prepareConsole(
                    target,
                    parsed!,
                    selected,
                    args,
                    value,
                  );
                  if (read)
                    setResult(
                      JSON.stringify(
                        await readConsole(prepared, parsed!),
                        (_, v) => (typeof v === "bigint" ? v.toString() : v),
                        2,
                      ),
                    );
                  else setCall(prepared);
                })
              }
            >
              {tr(busy ? "처리 중" : read ? "함수 조회" : "실행 내용 확인")}
            </button>
          </div>
          <div className="studio-panel">
            <h3>{tr("결과")}</h3>
            {!busy && (result || call) && (
              <p role="status">{tr("조회·준비 완료")}</p>
            )}
            {result && <pre className="code-box">{result}</pre>}
            {call && (
              <TransactionReview
                key={call.to + call.data + address + chain}
                call={call}
                address={address}
                chain={chain}
              />
            )}
            <p className="fine-print">
              {tr(
                "관리 함수는 연결 지갑의 실제 권한이 필요합니다. 계약 주소를 지갑처럼 가장해 전송하지 않습니다.",
              )}
            </p>
            {error && (
              <p className="notice danger" role="alert">
                {tr(error)}
              </p>
            )}
          </div>
        </div>
      </fieldset>
    </div>
  );
}
