import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Stamp,
} from "lucide-react";
import { tr } from "@/lib/i18n";
import { NETWORK, ZERO, short } from "@/lib/giwa";
import { ISSUER_METADATA_SOURCE } from "@/lib/issuer-metadata";
import {
  checkPlaygroundAttestation,
  PLAYGROUND_LINKS,
  type PlaygroundResult,
} from "@/lib/playground";
import { ChainLoading } from "./chain-loading";

export function PlaygroundInvite({ onStart }: { onStart: () => void }) {
  return (
    <aside className="playground-invite">
      <Stamp size={22} aria-hidden="true" />
      <div>
        <strong>{tr("테스트 도장 발급하기")}</strong>
        <p>
          {tr("GIWA Playground에서 발급받고, Dojang Scan에서 확인하세요.")}
        </p>
      </div>
      <button className="secondary-button" onClick={onStart}>
        {tr("시작하기")}
        <ArrowRight size={16} />
      </button>
    </aside>
  );
}
const statusCopy = {
  confirmed: "테스트 도장을 확인했습니다.",
  "not-found": "아직 테스트 도장이 조회되지 않았습니다.",
  revoked: "취소된 테스트 도장입니다.",
  expired: "만료된 테스트 도장입니다.",
  unverified: "이 도장의 주소 인증 값은 false입니다.",
} as const;
export default function PlaygroundGuide({
  onWallet,
}: {
  onWallet: (address: string) => void;
}) {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  async function check() {
    const request = ++sequence.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const found = await checkPlaygroundAttestation(address);
      if (request === sequence.current) setResult(found);
    } catch (e) {
      if (request === sequence.current) setError((e as Error).message);
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  }
  return (
    <section
      className="playground-guide"
      id="playground"
      aria-labelledby="playground-title"
    >
      <header className="playground-heading">
        <div>
          <span className="section-kicker">GIWA SEPOLIA</span>
          <h2 id="playground-title">{tr("테스트 도장 발급하기")}</h2>
          <p>{tr("직접 발급받은 도장의 발행자와 상태를 확인해 보세요.")}</p>
        </div>
        <a
          className="text-button"
          href={PLAYGROUND_LINKS.guide}
          target="_blank"
          rel="noreferrer"
        >
          {tr("공식 안내")}
          <ExternalLink size={14} />
        </a>
      </header>
      <ol className="playground-steps">
        <li>
          <span className="playground-step-number">01</span>
          <h3>{tr("테스트 ETH 준비")}</h3>
          <p>
            {tr(
              "GIWA Sepolia 네트워크와 테스트 ETH를 준비하세요. 발급 수수료와 가스는 Playground에서 확인할 수 있습니다.",
            )}
          </p>
          <a
            className="secondary-button"
            href={PLAYGROUND_LINKS.faucet}
            target="_blank"
            rel="noreferrer"
          >
            {tr("테스트 ETH 받기")}
            <ExternalLink size={14} />
          </a>
        </li>
        <li>
          <span className="playground-step-number">02</span>
          <h3>{tr("Playground에서 발급")}</h3>
          <p>
            {tr(
              "지갑 연결 → Issue Dojang → 지갑에서 거래 승인. 거래가 완료되면 이 화면으로 돌아오세요.",
            )}
          </p>
          <a
            className="secondary-button"
            href={PLAYGROUND_LINKS.playground}
            target="_blank"
            rel="noreferrer"
          >
            {tr("Playground 열기")}
            <ExternalLink size={14} />
          </a>
        </li>
        <li>
          <span className="playground-step-number">03</span>
          <h3>{tr("같은 지갑으로 조회")}</h3>
          <p>
            {tr(
              "발급에 사용한 지갑 주소를 아래에 입력하세요. 조회에는 지갑 연결이나 서명이 필요 없습니다.",
            )}
          </p>
          <a className="text-button" href="#playground-lookup">
            {tr("조회로 이동")}
            <ArrowRight size={14} />
          </a>
        </li>
      </ol>
      <p className="playground-note">
        {tr(
          "TESTNET FAUCET의 테스트용 주소 인증입니다. 실제 KYC나 잔액 증명이 아닙니다. 토큰·UP ID 발급은 이 체험에 필요하지 않습니다.",
        )}
      </p>
      <form
        className="wallet-form playground-form"
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <label htmlFor="playground-lookup">
          {tr("발급에 사용한 지갑 주소")}
        </label>
        <div>
          <input
            id="playground-lookup"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            value={address}
            disabled={busy}
            required
            onChange={(e) => {
              setAddress(e.target.value);
              setResult(null);
              setError("");
            }}
          />
          <button className="primary" disabled={busy}>
            {busy ? (
              <RefreshCw size={16} className="spinning" />
            ) : (
              <ArrowRight size={16} />
            )}
            {tr(busy ? "조회 중" : "발급 기록 확인")}
          </button>
        </div>
      </form>
      {busy && (
        <ChainLoading
          title="테스트 도장 발급 기록을 확인하고 있습니다."
          description="현재 등록된 발행자와 스키마를 조회한 뒤, 지갑의 발급 기록을 확인합니다."
        />
      )}
      {error && (
        <div className="notice danger" role="alert">
          <p>{tr(error)}</p>
          <button className="text-button" onClick={() => void check()}>
            {tr("다시 조회")}
            <RefreshCw size={14} />
          </button>
        </div>
      )}
      {result && (
        <div
          className={`playground-result ${result.status === "confirmed" ? "confirmed" : ""}`}
          role="status"
        >
          <strong>
            {result.status === "confirmed" && <CheckCircle2 size={19} />}
            {tr(statusCopy[result.status])}
          </strong>
          {result.status === "not-found" && (
            <p>
              {tr(
                "Playground의 거래 완료 여부와 지갑 주소를 확인하세요. 거래 완료와 조회 반영에 시간이 걸릴 수 있습니다.",
              )}
            </p>
          )}
          {(result.status === "revoked" ||
            result.status === "expired" ||
            result.status === "unverified") && (
            <p>
              {tr(
                "Playground에서 현재 상태를 확인한 뒤 다시 발급할 수 있습니다.",
              )}
            </p>
          )}
          <div className="playground-evidence">
            <a href={ISSUER_METADATA_SOURCE} target="_blank" rel="noreferrer">
              TESTNET FAUCET <ExternalLink size={12} />
            </a>
            <a
              href={`${NETWORK.explorer}/address/${result.issuer}`}
              target="_blank"
              rel="noreferrer"
            >
              <code>{short(result.issuer)}</code>
              <ExternalLink size={12} />
            </a>
            <span>{tr("조회 블록 {0}", [result.block.toLocaleString()])}</span>
          </div>
          <div className="playground-result-actions">
            {result.status === "confirmed" && (
              <button
                className="primary"
                onClick={() => onWallet(result.address)}
              >
                {tr("내 도장 보기")}
                <ArrowRight size={15} />
              </button>
            )}
            {result.uid !== ZERO && (
              <a
                className="text-button"
                href={`?view=wallet&uid=${result.uid}`}
              >
                {tr("도장 상세 보기")}
                <ArrowRight size={14} />
              </a>
            )}
            <button className="text-button" onClick={() => void check()}>
              {tr("다시 조회")}
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      )}
      <details className="playground-source">
        <summary>{tr("발행자 확인 방법")}</summary>
        <p>
          {tr(
            "이름과 ID는 GIWA 공식 문서를 기준으로 합니다. 발행자 주소는 DojangAttesterBook.getAttester(ID)에서 조회하며, 해당 주소·현재 스키마·수신 지갑·인증 값·취소·만료 상태가 일치해야 확인 완료로 표시합니다.",
          )}
        </p>
        <a href={ISSUER_METADATA_SOURCE} target="_blank" rel="noreferrer">
          {tr("발행자 이름 출처: GIWA 공식 문서")} ↗
        </a>
      </details>
    </section>
  );
}
