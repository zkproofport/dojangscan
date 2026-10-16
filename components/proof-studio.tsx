import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Fingerprint,
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
    confirmed: "테스트 도장을 확인했습니다.",
    "not-found": "아직 테스트 도장이 조회되지 않았습니다.",
    revoked: "취소된 테스트 도장입니다.",
    expired: "만료된 테스트 도장입니다.",
    unverified: "이 도장의 주소 인증 값은 false입니다.",
  };
  return (
    <section
      className="studio-workbench"
      aria-label={tr(mock ? "EAS KYC 목업 실습" : "Faucet 실습")}
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
                "Upbit KYC를 테스트넷에서 활용하는 데 한계가 있어, 메인넷 적용 전 흐름을 테스트하기 위해 만든 GIWA Sepolia EAS KYC 목업입니다.",
              )}
            </p>
            <p>
              {tr(
                "계정 주소를 support@masselabs.com으로 보내주시면 관리자가 테스트 계정을 등록해 드립니다. 등록 완료 안내를 받은 뒤 아래에서 조회해 주세요.",
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
            {tr("등록 요청 이메일")} <ArrowUpRight size={14} />
          </a>
        </section>
      )}
      <ol className="studio-progress" aria-label={tr("실습 진행 순서")}>
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
                  {tr(mock ? "등록된 계정 확인" : "발급받은 도장 확인")}
                </h3>
                <p>
                  {tr(
                    mock
                      ? "관리자에게 등록을 요청한 계정 주소를 입력하세요. 지갑 연결은 필요 없습니다."
                      : "Playground에서 사용한 지갑 주소를 입력하세요. 지갑 연결은 필요 없습니다.",
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
                  ) : (
                    <ArrowRight size={16} />
                  )}
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
                    <p>{tr("이 지갑을 ZKProofport 앱에서도 선택해 주세요.")}</p>
                    <a
                      href={`?view=wallet&uid=${flow.record.uid}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tr("도장 상세 보기")} <ArrowUpRight size={13} />
                    </a>
                  </>
                ) : (
                  <p>
                    {tr(
                      mock
                        ? "등록 상태와 계정 주소를 확인하세요. 미등록·취소·만료 상태라면 support@masselabs.com으로 문의해 주세요."
                        : "발급 완료 여부와 주소를 확인하세요. 취소되거나 만료된 도장은 Playground에서 다시 발급한 뒤 조회해 주세요.",
                    )}
                  </p>
                )}
              </div>
            )}
            {mock ? (
              <div className="studio-inline-help">
                <span>{tr("아직 등록되지 않았나요?")}</span>
                <a href="mailto:support@masselabs.com">
                  support@masselabs.com <ExternalLink size={13} />
                </a>
              </div>
            ) : (
              <>
                <div className="studio-inline-help">
                  <span>{tr("아직 도장이 없나요?")}</span>
                  <a
                    href={PLAYGROUND_LINKS.playground}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr("Playground에서 발급")} <ExternalLink size={13} />
                  </a>
                  <button className="text-button" onClick={onGuide}>
                    {tr("발급 가이드")} <ArrowRight size={13} />
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
                  {tr("휴대폰에서 ZK 증명 만들기")}
                </h3>
                <p>
                  {tr(
                    "앱을 준비했다면 증명을 요청하세요. PC에서는 QR을 스캔하고, 휴대폰에서는 앱을 열면 됩니다.",
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
                    {tr("앱의 응답을 기다리는 중")}
                  </span>
                  <h4>{tr("스캔하고, 요청을 확인하고, 서명하세요.")}</h4>
                  <p>
                    {tr(
                      mock
                        ? "등록한 계정으로 Practice 요청에 서명하세요. 증명 생성이 끝나면 이 화면으로 돌아오세요."
                        : "발급에 사용한 지갑으로 Practice 요청에 서명하세요. 증명 생성이 끝나면 이 화면으로 돌아오세요.",
                    )}
                  </p>
                  <a className="primary" href={flow.deepLink}>
                    <Smartphone size={16} />
                    {tr("ZKProofport 앱 열기")}
                  </a>
                  <p className="studio-small">
                    {tr(
                      "약 5분 안에 완료해 주세요. 시간이 지나면 새 요청을 만들 수 있습니다.",
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
                  <strong>{tr("앱에서 증명이 도착했습니다.")}</strong>
                  <p>
                    {tr("이제 아래에서 증명이 올바른지 직접 검증해 보세요.")}
                  </p>
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
                  <Fingerprint size={18} />
                )}
                {tr(
                  flow.phase === "requesting"
                    ? "증명 요청 준비 중"
                    : "ZK 증명 요청하기",
                )}
              </button>
            )}
            {!confirmed && (
              <p className="studio-small">
                {tr("먼저 01 단계에서 도장을 확인해 주세요.")}
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
                  {tr(verified ? "검증 완료" : "증명 검증하기")}
                </h3>
                <p>
                  {tr(
                    verified
                      ? "GIWA Sepolia의 검증 컨트랙트가 이번 실습 증명을 확인했습니다."
                      : "돌아온 증명을 GIWA Sepolia에서 검증합니다. 지갑 서명이나 가스비는 필요 없습니다.",
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
                      ? "허용된 목업 발급자가 이 계정의 등록 트랜잭션에 서명했고, 같은 계정이 이번 실습 요청에 서명했음을 확인합니다."
                      : "이 증명은 같은 지갑이 Playground 발급 트랜잭션과 이번 실습 요청에 서명했음을 확인합니다.",
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
                {tr(
                  flow.phase === "verifying" ? "증명 검증 중" : "증명 검증하기",
                )}
              </button>
            )}
            {flow.proof && <ProofInspector proof={flow.proof} />}
            {verified && (
              <button className="text-button" onClick={() => flow.reset()}>
                {tr("다시 실습하기")} <RefreshCw size={14} />
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
              <img
                src={`${import.meta.env.BASE_URL}brand/zkproofport.png`}
                alt=""
                width="44"
                height="44"
              />
              <div>
                <strong>ZKProofport</strong>
                <span>{tr("증명은 내 휴대폰에서")}</span>
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
                <ArrowUpRight size={14} />
              </a>
              <a
                className="secondary-button"
                href="https://play.google.com/store/apps/details?id=com.masselabs.zkproofport"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={16} />
                Google Play
                <ArrowUpRight size={14} />
              </a>
            </div>
            <ol className="studio-app-steps">
              <li>
                {tr(
                  mock
                    ? "관리자가 등록한 계정과 같은 지갑을 연결하세요."
                    : "Playground 발급에 사용한 같은 지갑을 연결하세요.",
                )}
              </li>
              <li>
                {tr("이 화면에서 증명을 요청하고 앱으로 QR을 스캔하세요.")}
              </li>
            </ol>
          </section>
          <section className="studio-about">
            <span className="section-kicker">
              {tr("이번 실습에서 배우는 것")}
            </span>
            <h3>{tr("발급 → 증명 → 검증")}</h3>
            <p>
              {tr(
                "메인넷 도장을 이용하기 전에, 테스트넷에서 증명 생성과 검증을 실습합니다.",
              )}
            </p>
            <details>
              <summary>{tr("무엇을 증명하나요?")}</summary>
              <p>
                {tr(
                  mock
                    ? "관리자의 계정 등록 서명과 계정 소유자의 실습 요청 서명을 증명합니다. 현재 KYC 상태나 도장의 취소·만료, 등록 트랜잭션의 채굴 여부는 증명에 포함되지 않습니다."
                    : "지갑의 발급 트랜잭션 서명과 실습 요청 서명을 증명합니다. 도장의 현재 취소·만료 상태나 트랜잭션의 채굴 여부는 증명에 포함되지 않습니다.",
                )}
              </p>
              <p>
                {tr(
                  "도장 조회와 ZK 검증은 별도 단계입니다. 조회한 주소는 이 페이지에서 알고 있으며, 이미 공개된 온체인 정보를 숨기는 실습은 아닙니다.",
                )}
              </p>
            </details>
          </section>
        </aside>
      </div>
    </section>
  );
}
