import { useEffect, useRef, useState } from "react";
import { ZeroAddress } from "ethers";
import { getLocale } from "@/lib/preferences";
import { tr } from "@/lib/i18n";
import {
  buildBalanceInputs,
  exportBalanceProof,
  type BalanceProof,
} from "@/lib/balance-proof";
import { createOffchainExample } from "@/lib/examples";
import { Badge } from "./scan-ui";
import { TransactionReview } from "./transaction-review";
import { prepareBalanceRegistration } from "@/lib/balance-registration";
import type { PreparedCall } from "@/lib/workspace";
import { downloadJSON } from "./scan-detail";
import { Field } from "./workspace";
export default function BalanceStudio({
  initialDocument = "",
  initialIssuer = "",
  address = "",
  chain = 0,
}: {
  initialDocument?: string;
  initialIssuer?: string;
  address?: string;
  chain?: number;
}) {
  const [source, setSource] = useState(initialDocument),
    [issuer, setIssuer] = useState(initialIssuer),
    [threshold, setThreshold] = useState("500000"),
    [scope, setScope] = useState("dojang-scan:balance-demo"),
    [registry, setRegistry] = useState(ZeroAddress),
    [proof, setProof] = useState<BalanceProof | null>(null),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState(""),
    [error, setError] = useState(""),
    [verification, setVerification] = useState(""),
    [imported, setImported] = useState("");
  const [registration, setRegistration] = useState<PreparedCall | null>(null);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const reset = () => {
    setProof(null);
    setRegistration(null);
    setVerification("");
    setError("");
  };
  const edit = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    reset();
  };
  async function loadExample() {
    setBusy(true);
    reset();
    try {
      const a = await createOffchainExample();
      setSource(JSON.stringify(a, null, 2));
      setIssuer(a.attester);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start(input?: BalanceProof, context = "") {
    setError("");
    setVerification("");
    setBusy(true);
    setPhase("loading");
    if (!input) {
      setProof(null);
      setRegistration(null);
    }
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}zk/offchain_balance.json`,
      );
      if (!response.ok) throw new Error("Circuit artifact unavailable.");
      const circuit = await response.json();
      const args = input
        ? { proof: input }
        : buildBalanceInputs(
            JSON.parse(source),
            issuer,
            threshold,
            scope,
            registry,
          );
      worker.current?.terminate();
      const w = new Worker(
        new URL("../src/workers/balance.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = w;
      w.onmessage = (e) => {
        if (e.data.phase) setPhase(e.data.phase);
        if (e.data.error) {
          setError(e.data.error);
          setBusy(false);
          w.terminate();
          worker.current = null;
        }
        if (e.data.result) {
          if (input)
            setVerification(
              (context ? tr(context) + ": " : "") +
                tr(e.data.result.valid ? "ZK 검증 통과" : "ZK 검증 실패") +
                ` · ${e.data.result.elapsedMs} ms`,
            );
          else {
            setProof(e.data.result);
            setVerification(tr("ZK 검증 통과"));
          }
          setBusy(false);
          w.terminate();
          worker.current = null;
        }
      };
      w.onerror = (e) => {
        setError(e.message);
        setBusy(false);
        w.terminate();
        worker.current = null;
      };
      w.postMessage({ circuit, ...args });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  function stop() {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setPhase("");
    setError(tr("증명 작업을 중단했습니다."));
  }
  const phaseLabels: Record<string, string> = {
    loading: "회로 불러오는 중",
    witness: "서명·조건 검사 중",
    prove: "ZK proof 생성 중",
    verify: "ZK proof 검증 중",
  };
  return (
    <div className="studio-grid balance-studio">
      <div className="studio-panel">
        <Badge variant="purple">Noir · UltraHonk ZK</Badge>
        <h3>{tr("오프체인 잔액 → ZK proof")}</h3>
        <p>
          {tr(
            "발행자의 EIP-712 서명과 잔액 기준을 실제 회로에서 검증합니다. 정확한 잔액과 원문·서명은 proof에 포함하지 않습니다.",
          )}
        </p>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => void loadExample()}
        >
          {tr("서명된 100만원 예제")}
        </button>
        <p className="fine-print">
          {tr(
            "임시 테스트 키가 서명한 예제입니다. 실제 은행 도장이나 GIWA의 신뢰 발행자가 아닙니다.",
          )}
        </p>
        <fieldset disabled={busy} className="workspace-controls">
          <Field
            label={tr("기대 발행자 주소")}
            value={issuer}
            setValue={edit(setIssuer)}
          />
          <Field
            label={tr("기준 금액 (KRW)")}
            value={threshold}
            setValue={edit(setThreshold)}
          />
          <Field label="Scope" value={scope} setValue={edit(setScope)} />
          <Field
            label={tr("등록 계약 주소 (브라우저 테스트는 0 주소)")}
            value={registry}
            setValue={edit(setRegistry)}
          />
          <label className="input-label">
            {tr("서명 문서 JSON")}
            <textarea
              className="json-input"
              value={source}
              onChange={(e) => edit(setSource)(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !source || !issuer}
            onClick={() => void start()}
          >
            {tr("실제 ZK proof 생성")}
          </button>
        </fieldset>
        {busy && (
          <div className="notice" role="status">
            <span>{tr(phaseLabels[phase] || "처리 중")}</span>
            <button className="text-button" onClick={stop}>
              {tr("중단")}
            </button>
            <small>
              {tr(
                "첫 실행은 공개 CRS를 다운로드합니다. 브라우저에서 수십 초 이상 걸릴 수 있습니다.",
              )}
            </small>
          </div>
        )}
        {error && (
          <p className="notice danger" role="alert">
            {tr(error)}
          </p>
        )}
      </div>
      <div className="studio-panel">
        <h3>{tr("공개 결과·검증")}</h3>
        {verification && (
          <Badge
            variant={
              verification.includes(tr("ZK 검증 통과")) ? "success" : "danger"
            }
          >
            {verification}
          </Badge>
        )}
        {proof ? (
          <>
            <dl className="result-facts">
              <div>
                <dt>{tr("잔액 조건")}</dt>
                <dd>
                  ≥{" "}
                  {BigInt(proof.statement.threshold).toLocaleString(
                    getLocale(),
                  )}{" "}
                  KRW
                </dd>
              </div>
              <div>
                <dt>{tr("발행자")}</dt>
                <dd>
                  <code>{proof.statement.issuer}</code>
                </dd>
              </div>
              <div>
                <dt>{tr("수신 지갑")}</dt>
                <dd>
                  <code>{proof.statement.recipient}</code>
                </dd>
              </div>
              <div>
                <dt>{tr("생성·검증 시간")}</dt>
                <dd>{(proof.elapsedMs / 1000).toFixed(1)} s</dd>
              </div>
              <div>
                <dt>{tr("공개 입력 / proof")}</dt>
                <dd>
                  {proof.publicInputs.length} / {(proof.proof.length - 2) / 2}{" "}
                  bytes
                </dd>
              </div>
            </dl>
            <div className="example-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  downloadJSON(
                    exportBalanceProof(proof),
                    "balance-zk-proof.json",
                  )
                }
              >
                {tr("Proof JSON 저장")}
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void start(proof)}
              >
                {tr("다시 검증")}
              </button>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  const tampered = structuredClone(proof);
                  tampered.publicInputs[94] =
                    "0x" +
                    (BigInt(tampered.publicInputs[94]) + 1n)
                      .toString(16)
                      .padStart(64, "0");
                  tampered.statement.threshold = String(
                    BigInt(tampered.statement.threshold) + 1n,
                  );
                  void start(tampered, "변조 테스트");
                }}
              >
                {tr("기준 금액 변조 테스트")}
              </button>
            </div>
            <button
              className="secondary-button"
              disabled={
                busy || !address || proof.statement.registry === ZeroAddress
              }
              onClick={() => {
                setBusy(true);
                setError("");
                void prepareBalanceRegistration(proof, address)
                  .then(setRegistration)
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              {tr("온체인 등록 준비")}
            </button>
            {registration && (
              <TransactionReview
                key={registration.data + address + chain}
                call={registration}
                address={address}
                chain={chain}
              />
            )}
            <p className="fine-print">
              {tr(
                "등록하려면 배포한 receipt 계약 주소로 다시 증명하고 원본 수신 지갑을 연결하세요. 브라우저 예제의 임시 지갑은 등록용이 아닙니다.",
              )}
            </p>
            <details className="explain-detail">
              <summary>{tr("공개 statement / VK hash")}</summary>
              <pre className="code-box">
                {JSON.stringify(
                  {
                    ...proof.statement,
                    vkHash: proof.vkHash,
                    circuitHash: proof.circuitHash,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </>
        ) : (
          <div className="proof-preview">
            <strong>{tr("예제: 잔액 100만원, 기준 50만원")}</strong>
            <p>
              {tr(
                "검증자는 “기대 발행자가 서명한 잔액이 50만원 이상”이라는 결과와 수신 지갑·만료·scope를 확인합니다.",
              )}
            </p>
            <p>
              {tr(
                "기준을 100만원 초과로 바꾸면 증명 생성이 실패합니다. 생성된 proof의 기준을 바꾸면 검증이 실패합니다.",
              )}
            </p>
          </div>
        )}
        <p className="notice">
          {tr(
            "개발용 프로필: 발행자 등록·은행의 사실 확인·원본 취소 상태는 증명하지 않습니다. 원본 문서는 만료가 있어야 합니다.",
          )}
        </p>
        <details className="explain-detail">
          <summary>{tr("온체인 테스트와 ZKProofport 연동")}</summary>
          <p>
            {tr(
              "같은 회로의 Solidity verifier와 테스트용 receipt 계약을 제공합니다. 로컬 Anvil 검증에서 실제 proof를 등록하고 재사용·변조를 검사합니다.",
            )}
          </p>
          <p>
            {tr(
              "CIP-4 앱 증명과는 별도 프로필입니다. 회로 JSON·proof·공개 입력·VK hash로 개발 중인 회로와 verifier를 비교할 수 있습니다.",
            )}
          </p>
          <code>npm run test:zk</code>
          <br />
          <code>npm run test:zk:onchain</code>
        </details>
        <details className="explain-detail">
          <summary>{tr("내보낸 proof 검증")}</summary>
          <textarea
            aria-label="Proof JSON"
            className="json-input"
            value={imported}
            onChange={(e) => setImported(e.target.value)}
          />
          <button
            className="secondary-button"
            disabled={busy || !imported}
            onClick={() => {
              try {
                void start(JSON.parse(imported));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {tr("가져온 proof 검증")}
          </button>
        </details>
      </div>
    </div>
  );
}
