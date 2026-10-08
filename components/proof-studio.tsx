import {
  ArrowUpRight,
  Fingerprint,
  Wallet,
  MonitorCheck,
  Download,
  ShieldCheck,
  LockKeyhole,
  ArrowRight,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { tr } from "@/lib/i18n";

const examples = {
  kyc: {
    label: "KYC 인증",
    attestation: "KYC 완료 도장",
    privateData: "이름 · 생년월일 · 인증한 계정 정보",
    result: "KYC를 완료한 사용자입니다.",
  },
  balance: {
    label: "잔액 조건 증명",
    attestation: "잔액 인증 도장",
    privateData: "계정 정보 · 정확한 잔액",
    result: "잔액이 100만 원 이상입니다.",
  },
} as const;

export default function ProofStudio() {
  const [example, setExample] = useState<keyof typeof examples>("kyc");
  const selected = examples[example];

  return (
    <section className="proof-coming">
      <div className="proof-coming-heading">
        <div className="proof-coming-notice">
          <Fingerprint size={30} aria-hidden="true" />
          <strong>Coming soon</strong>
        </div>
        <h2>
          {tr("계정 정보는 공개하지 않고,")}
          <br />
          {tr("필요한 사실만 증명하세요.")}
        </h2>
        <p>
          {tr(
            "도장을 모바일에서 ZK 증명으로 바꿔, Dapp에 KYC 완료 여부나 잔액 조건 충족만 전달합니다.",
          )}
        </p>
      </div>
      <section
        className="proof-diagram"
        aria-label={tr("도장에서 Dapp까지의 증명 과정")}
      >
        <div className="proof-diagram-toolbar">
          <div
            className="proof-example-switch"
            role="group"
            aria-label={tr("증명 예시 선택")}
          >
            {(Object.keys(examples) as (keyof typeof examples)[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={example === key}
                onClick={() => setExample(key)}
              >
                {tr(examples[key].label)}
              </button>
            ))}
          </div>
          <span>{tr("도장 연동 예정 예시")}</span>
        </div>
        <div className="proof-pipeline" aria-live="polite">
          <article className="proof-stage proof-source">
            <header>
              <span>01</span>
              <h3>{tr("도장")}</h3>
            </header>
            <div className="proof-attestation-mark">
              <ShieldCheck size={32} aria-hidden="true" />
            </div>
            <strong>{tr(selected.attestation)}</strong>
            <p>{tr("발행자가 확인한 사실을 증명의 근거로 사용합니다.")}</p>
          </article>
          <div className="proof-connector" aria-hidden="true">
            <ArrowRight size={26} />
            <span>{tr("도장 선택")}</span>
          </div>
          <article className="proof-stage proof-mobile">
            <header>
              <span>02</span>
              <h3>{tr("ZKProofport 앱")}</h3>
            </header>
            <div className="proof-sealed">
              <LockKeyhole size={22} aria-hidden="true" />
              <div>
                <strong>{tr("Dapp에 공개하지 않음")}</strong>
                <p>{tr(selected.privateData)}</p>
              </div>
              <span className="proof-masked" aria-hidden="true">
                •••• •••• ••••
              </span>
            </div>
            <div className="proof-output">
              <Fingerprint size={20} aria-hidden="true" />
              <span>{tr("모바일에서 ZK 증명 생성")}</span>
            </div>
          </article>
          <div
            className="proof-connector proof-connector-output"
            aria-hidden="true"
          >
            <ArrowRight size={26} />
            <span>{tr("ZK 증명")}</span>
          </div>
          <article className="proof-stage proof-dapp">
            <header>
              <span>03</span>
              <h3>Dapp</h3>
            </header>
            <MonitorCheck size={30} aria-hidden="true" />
            <span className="proof-result-label">
              {tr("증명으로 확인할 사실")}
            </span>
            <strong>{tr(selected.result)}</strong>
            <p>{tr("개인정보 원본 대신 증명을 검증합니다.")}</p>
          </article>
        </div>
        <p className="proof-public-note">
          {tr("이미 온체인에 공개된 정보는 숨겨지지 않습니다.")}
        </p>
      </section>
      <div className="proof-benefits">
        <div>
          <LockKeyhole size={20} aria-hidden="true" />
          <div>
            <h3>{tr("사용자는 개인정보 노출을 줄이고")}</h3>
            <p>
              {tr(
                "서비스를 이용할 때마다 계정 정보와 상세 잔액을 공유하지 않아도 됩니다.",
              )}
            </p>
          </div>
        </div>
        <div>
          <Building2 size={20} aria-hidden="true" />
          <div>
            <h3>{tr("서비스는 개인정보 보관 부담을 줄입니다")}</h3>
            <p>
              {tr(
                "원본 개인정보 대신 증명을 검증해, 불필요한 수집·보관과 보호 부담을 줄일 수 있습니다.",
              )}
            </p>
          </div>
        </div>
      </div>
      <div className="proof-availability">
        <div>
          <strong>{tr("도장 연동 준비 중")}</strong>
          <p>
            {tr(
              "본인 지갑의 유효한 Dojang 도장이 필요합니다. 모든 도장 종류를 연결하는 것을 목표로 준비 중이며, 현재는 증명을 요청할 수 없습니다.",
            )}
          </p>
        </div>
        <button className="primary" disabled>
          <Wallet size={16} />
          {tr("내 도장 불러오기 · 준비 중")}
        </button>
      </div>
      <div className="app-downloads">
        <div>
          <img
            className="proofport-logo"
            src={`${import.meta.env.BASE_URL}brand/zkproofport.png`}
            alt="ZKProofport"
            width="48"
            height="48"
          />
          <div>
            <h3>ZKProofport</h3>
            <a
              className="gasok-participation"
              href="https://giwa.io/gasok"
              target="_blank"
              rel="noopener noreferrer"
            >
              {tr("GIWA GASOK 프로그램 참여 팀")}
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
        <div className="download-links">
          <a
            className="secondary-button"
            href="https://apps.apple.com/kr/app/zkproofport/id6803903114"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download size={16} />
            iOS · App Store
            <ArrowUpRight size={15} />
          </a>
          <a
            className="secondary-button"
            href="https://play.google.com/store/apps/details?id=com.masselabs.zkproofport"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download size={16} />
            Android · Google Play
            <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}
