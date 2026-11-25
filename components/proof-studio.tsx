import { ZkProofportLogo } from "./zkproofport-logo";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  Smartphone,
  Stamp,
  ShieldCheck,
} from "lucide-react";
import { tr } from "@/lib/i18n";
import { PLAYGROUND_LINKS } from "@/lib/playground";
import type { StudioCircuit } from "@/lib/proof-studio";
import { ProofInspector } from "./proof-inspector";
import { useProofStudio } from "@/lib/use-proof-studio";

type PracticeProps = {
  initialAddress?: string;
  onGuide: () => void;
  circuit?: StudioCircuit;
};

// Each proof type owns its form and lifecycle. Switching types unmounts the old session.
const proofTypes = [
  {
    id: "dojang_playground",
    title: "Faucet",
    description: "Playground 발급 지갑 증명",
    network: "GIWA Sepolia",
    component: AttestationPractice,
  },
  {
    id: "giwa_attestation",
    title: "EAS KYC Mock",
    description: "관리자 등록 계정 증명",
    network: "GIWA Sepolia",
    component: AttestationPractice,
  },
];

export default function ProofStudio(props: PracticeProps) {
  const [selected, setSelected] = useState(proofTypes[0].id);
  const active = proofTypes.find((item) => item.id === selected)!;
  const Practice = active.component;
  return (
    <section className="studio" aria-label="Proof Studio">
      <div className="studio-catalog">
        <h2>{tr("증명 유형")}</h2>
        <div className="studio-type-list" aria-label={tr("증명 유형 선택")}>
          {proofTypes.map((item) => (
            <button
              key={item.id}
              className="studio-type"
              aria-pressed={item.id === selected}
              onClick={() => setSelected(item.id)}
            >
              <Stamp size={20} aria-hidden="true" />
              <span>
                <strong>{item.title}</strong>
                <span>{tr(item.description)}</span>
              </span>
              <span className="studio-type-network">{item.network}</span>
              {item.id === selected && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
      <Practice
        key={active.id}
        {...props}
        circuit={active.id as StudioCircuit}
      />
    </section>
  );
}

function AttestationPractice({
  initialAddress = "",
  onGuide,
  circuit = "dojang_playground",
}: PracticeProps) {
  const mock = circuit === "giwa_attestation";
  const flow = useProofStudio(initialAddress, circuit);
  const confirmed = flow.record?.status === "confirmed";
  const received = !!flow.proof;
  const verified = flow.phase === "verified";
  const status = {
    confirmed: "테스트넷 도장 조회 완료",
    "not-found": "조회 범위 내 테스트넷 도장 없음",
    revoked: "철회된 테스트넷 도장",
    expired: "만료된 테스트넷 도장",
    unverified: "이 도장의 주소 인증 값은 false입니다.",
  };
  return (
    <section
      className="studio-workbench"
      aria-label={tr(mock ? "EAS KYC 목업 증명" : "Faucet 증명")}
    >
      {mock && (
        <section
          className="studio-registration"
          aria-labelledby="mock-registration-title"
        >
          <div>
            <h2 id="mock-registration-title">{tr("관리자 계정 등록")}</h2>
            <p>
              {tr(
                "GIWA Sepolia의 계정 등록 증명용 테스트 목업입니다.",
              )}
            </p>
            <p>
              {tr(
                "관리자 등록 후 조회 가능 · 등록 문의: support@masselabs.com",
              )}
            </p>
            <span>
              {tr("Masse Labs 테스트용 목업 · 실제 Upbit KYC 인증이 아닙니다.")}
            </span>
          </div>
          <a
            className="secondary-button"
            href="mailto:support@masselabs.com?subject=GIWA%20Sepolia%20KYC%20Mock%20Registration"
          >
            {tr("등록 요청 이메일")}
          </a>
        </section>
      )}
      <ol className="studio-progress" aria-label={tr("증명 처리 단계")}>
        {[
          { label: mock ? "등록 확인" : "도장 확인", done: confirmed },
          { label: "앱에서 증명 생성", done: received },
          { label: "증명 검증", done: verified },
        ].map((step, i) => (
          <li key={step.label} className={step.done ? "done" : ""}>
            <span>{step.done ? <Check size={16} /> : `0${i + 1}`}</span>
            {tr(step.label)}
          </li>
        ))}
      </ol>
      <div className="studio-columns">
        <div className="studio-main">
          <section className="studio-card" aria-labelledby="studio-check-title">
            <header>
              <span className="studio-step">01</span>
              <div>
                <h3 id="studio-check-title">
                  {tr(mock ? "계정 등록 조회" : "도장 조회")}
                </h3>
                <p>
                  {tr(
                    mock
                      ? "관리자 등록 계정 주소로 조회합니다. 지갑 연결은 필요하지 않습니다."
                      : "Playground 발급 지갑 주소로 조회합니다. 지갑 연결은 필요하지 않습니다.",
                  )}
                </p>
              </div>
            </header>
            <form
              className="wallet-form"
              onSubmit={(e) => {
                e.preventDefault();
                void flow.check();
              }}
            >
              <label htmlFor="studio-address">
                {tr(mock ? "등록한 계정 주소" : "발급에 사용한 지갑 주소")}
              </label>
              <div>
                <input
                  id="studio-address"
                  placeholder="0x…"
                  value={flow.address}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  disabled={flow.busy}
                  onChange={(e) => flow.reset(e.target.value)}
                />
                <button className="primary" disabled={flow.busy}>
                  {flow.phase === "checking" ? (
                    <RefreshCw size={16} className="spinning" />
                  ) : null}
                  {tr(
                    flow.phase === "checking"
                      ? "조회 중"
                      : mock
                        ? "등록 확인"
                        : "도장 확인",
                  )}
                </button>
              </div>
            </form>
            {flow.record && (
              <div
                className={`studio-check-result ${confirmed ? "is-confirmed" : ""}`}
                role="status"
              >
                <strong>
                  {confirmed && <CheckCircle2 size={18} />}
                  {tr(status[flow.record.status])}
                </strong>
                {confirmed ? (
                  <>
                    <p>
                      {tr("ZKProofport 앱에서도 동일한 지갑이 필요합니다.")}
                    </p>
                    <a
                      href={`?view=wallet&uid=${flow.record.uid}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tr("도장 상세 보기")}
                    </a>
                  </>
                ) : (
                  <p>
                    {tr(
                      mock
                        ? "등록 상태와 계정 주소 확인이 필요합니다. 미등록·철회·만료 관련 문의: support@masselabs.com"
                        : "발급 상태와 주소 확인이 필요합니다. 철회·만료된 도장은 Playground 재발급 대상입니다.",
                    )}
                  </p>
                )}
              </div>
            )}
            {mock ? (
              <div className="studio-inline-help">
                <span>{tr("테스트 계정 등록")}</span>
                <a href="mailto:support@masselabs.com">support@masselabs.com</a>
              </div>
            ) : (
              <>
                <div className="studio-inline-help">
                  <span>{tr("테스트넷 도장 발급")}</span>
                  <a
                    href={PLAYGROUND_LINKS.playground}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr("Playground에서 발급")}
                  </a>
                  <button className="text-button" onClick={onGuide}>
                    {tr("발급 가이드")}
                  </button>
                </div>
              </>
            )}
          </section>
          <section
            className={`studio-card ${!confirmed ? "studio-pending" : ""}`}
            aria-labelledby="studio-generate-title"
          >
            <header>
              <span className="studio-step">02</span>
              <div>
                <h3 id="studio-generate-title">
                  {tr("ZK 증명 생성")}
                </h3>
                <p>
                  {tr(
                    "증명 요청 후 PC에서는 QR 스캔, 휴대폰에서는 앱 연결을 사용합니다.",
                  )}
                </p>
              </div>
            </header>
            {flow.phase === "waiting" ? (
              <div className="studio-request">
                <img
                  src={flow.qr}
                  alt={tr("ZKProofport 증명 요청 QR 코드")}
                  width="320"
                  height="320"
                />
                <div>
                  <span className="studio-live">
                    <span />
                    {tr("앱 응답 대기 중")}
                  </span>
                  <h4>{tr("앱에서 요청 확인 및 서명")}</h4>
                  <p>
                    {tr(
                      mock
                        ? "등록 계정으로 Practice 요청에 서명합니다. 생성된 증명은 이 화면에서 검증합니다."
                        : "발급 지갑으로 Practice 요청에 서명합니다. 생성된 증명은 이 화면에서 검증합니다.",
                    )}
                  </p>
                  <a className="primary" href={flow.deepLink}>
                    <Smartphone size={16} />
                    {tr("ZKProofport 앱 열기")}
                  </a>
                  <p className="studio-small">
                    {tr(
                      "요청 유효 시간은 약 5분입니다. 만료 후 새 요청을 생성할 수 있습니다.",
                    )}
                  </p>
                  <button className="text-button" onClick={() => flow.reset()}>
                    {tr("요청 취소")}
                  </button>
                </div>
              </div>
            ) : received ? (
              <div className="studio-received" role="status">
                <CheckCircle2 size={22} />
                <div>
                  <strong>{tr("증명 수신 완료")}</strong>
                  <p>{tr("증명 검증 가능")}</p>
                </div>
              </div>
            ) : (
              <button
                className="primary"
                disabled={!confirmed || flow.busy}
                onClick={() => void flow.request()}
              >
                {flow.phase === "requesting" ? (
                  <RefreshCw size={17} className="spinning" />
                ) : (
                  <ZkProofportLogo size={18} />
                )}
                {tr(
                  flow.phase === "requesting"
                    ? "증명 요청 준비 중"
                    : "ZK 증명 요청",
                )}
              </button>
            )}
            {!confirmed && (
              <p className="studio-small">
                {tr("도장 조회 후 증명 요청 가능")}
              </p>
            )}
          </section>
          <section
            className={`studio-card ${!received ? "studio-pending" : ""} ${verified ? "studio-success" : ""}`}
            aria-labelledby="studio-verify-title"
          >
            <header>
              <span className="studio-step">
                {verified ? <Check size={16} /> : "03"}
              </span>
              <div>
                <h3 id="studio-verify-title">
                  {tr(verified ? "증명 검증 완료" : "증명 검증")}
                </h3>
                <p>
                  {tr(
                    verified
                      ? "현재 요청의 증명을 GIWA Sepolia 검증 계약에서 검증했습니다."
                      : "수신된 증명을 GIWA Sepolia에서 검증합니다. 지갑 서명과 가스비는 필요하지 않습니다.",
                  )}
                </p>
              </div>
            </header>
            {verified ? (
              <>
                <div className="studio-verification">
                  <span>
                    <CheckCircle2 size={17} />
                    {tr("이번 요청과 일치")}
                  </span>
                  <span>
                    <CheckCircle2 size={17} />
                    {tr("조회한 지갑과 일치")}
                  </span>
                  <span>
                    <CheckCircle2 size={17} />
                    {tr("ZK 증명 검증 통과")}
                  </span>
                </div>
                <p>
                  {tr(
                    mock
                      ? "허용된 목업 발행자의 계정 등록 트랜잭션 서명과 동일 계정의 현재 Practice 요청 서명을 검증합니다."
                      : "동일 지갑의 Playground 발급 트랜잭션 서명과 현재 Practice 요청 서명을 검증합니다.",
                  )}
                </p>
              </>
            ) : (
              <button
                className="primary"
                disabled={!received || flow.busy}
                onClick={() => void flow.verify()}
              >
                {flow.phase === "verifying" ? (
                  <RefreshCw size={17} className="spinning" />
                ) : (
                  <ShieldCheck size={18} />
                )}
                {tr(flow.phase === "verifying" ? "증명 검증 중" : "증명 검증")}
              </button>
            )}
            {flow.proof && <ProofInspector proof={flow.proof} />}
            {verified && (
              <button className="text-button" onClick={() => flow.reset()}>
                {tr("새 증명 요청")} <RefreshCw size={14} />
              </button>
            )}
          </section>
          {flow.error && (
            <div className="notice danger" role="alert">
              <p>{tr(flow.error)}</p>
            </div>
          )}
          {flow.notice && (
            <div className="notice" role="status">
              <p>{tr(flow.notice)}</p>
            </div>
          )}
        </div>
        <aside className="studio-aside">
          <section className="studio-app-card">
            <div className="studio-app-brand">
              <ZkProofportLogo size={44} />
              <div>
                <strong>ZKProofport</strong>
                <span>{tr("ZKProofport 앱")}</span>
              </div>
            </div>
            <h3>{tr("앱 설치")}</h3>
            <p>{tr("ZKProofport 앱에서 증명을 생성합니다.")}</p>
            <div className="studio-downloads">
              <a
                className="secondary-button"
                href="https://apps.apple.com/kr/app/zkproofport/id6803903114"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={16} />
                App Store
              </a>
              <a
                className="secondary-button"
                href="https://play.google.com/store/apps/details?id=com.masselabs.zkproofport"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={16} />
                Google Play
              </a>
            </div>
            <ol className="studio-app-steps">
              <li>
                {tr(
                  mock
                    ? "관리자 등록 계정과 동일한 지갑 연결"
                    : "Playground 발급 지갑 연결",
                )}
              </li>
              <li>{tr("증명 요청 후 앱에서 QR 스캔")}</li>
            </ol>
          </section>
          <section className="studio-about">
            <span className="section-kicker">{tr("증명 범위 및 한계")}</span>
            <h3>{tr("테스트넷 증명 범위")}</h3>
            <p>
              {tr(
                "테스트넷 증명 생성·검증 환경입니다. 메인넷 자격 검증을 제공하지 않습니다.",
              )}
            </p>
            <details>
              <summary>{tr("증명 범위")}</summary>
              <p>
                {tr(
                  mock
                    ? "관리자 계정 등록 서명과 계정 소유자의 Practice 요청 서명을 증명합니다. 현재 KYC·도장 철회·만료 상태와 등록 트랜잭션의 블록 포함 여부는 증명 범위 밖입니다."
                    : "발급 트랜잭션과 Practice 요청의 서명을 증명합니다. 현재 도장 철회·만료 상태와 트랜잭션의 블록 포함 여부는 증명 범위 밖입니다.",
                )}
              </p>
              <p>
                {tr(
                  "도장 조회와 ZK 검증은 별개입니다. 이 페이지는 조회 주소를 처리하며, 이미 공개된 온체인 정보를 비공개로 전환하지 않습니다.",
                )}
              </p>
            </details>
          </section>
        </aside>
      </div>
    </section>
  );
}
