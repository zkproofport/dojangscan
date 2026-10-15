import { Download, ArrowRight } from "lucide-react";
import { tr } from "../lib/i18n";
import { NETWORK, short } from "../lib/giwa";
import {
  STUDIO_PROFILES,
  responseContainsAddress,
  studioPublicFields,
  type StudioProof,
} from "../lib/proof-studio";

export function ProofInspector({
  proof,
  address,
  verified,
}: {
  proof: StudioProof;
  address: string;
  verified: boolean;
}) {
  const verifier = STUDIO_PROFILES[proof.circuit].verifier;
  const fields = studioPublicFields(proof);
  const containsAddress = responseContainsAddress(proof, address);
  const raw = JSON.stringify(proof.response, null, 2);
  return (
    <section className="studio-evidence" aria-labelledby="proof-data-title">
      <header className="studio-data-header">
        <h4 id="proof-data-title">{tr("수신 데이터")}</h4>
        <span>{tr(verified ? "검증 완료" : "수신 완료 · 검증 전")}</span>
      </header>
      <div className="studio-data-flow">
        <div>
          <span className="studio-data-label">
            {tr("조회할 때 입력한 주소")}
          </span>
          <code>{address}</code>
          <p>{tr("이 페이지에서 도장 조회에 사용한 값")}</p>
        </div>
        <ArrowRight size={18} aria-hidden="true" />
        <div>
          <span className="studio-data-label">
            {tr("수신 응답 내 주소 원문")}
          </span>
          <strong>{tr(containsAddress ? "발견됨" : "없음")}</strong>
          <p>{tr("응답 문자열과 공개 입력의 바이트 값을 비교한 결과")}</p>
        </div>
      </div>
      <p className="studio-privacy-note">
        {tr(
          "주소 원문이 없어도 완전한 익명성을 뜻하지는 않습니다. Nullifier는 주소와 실습 범위로 계산할 수 있어, 알고 있는 주소와 대조하거나 같은 지갑의 실습을 연결할 수 있습니다.",
        )}
      </p>
      <dl className="studio-data-meta">
        <dt>{tr("요청 ID")}</dt>
        <dd>{proof.requestId}</dd>
        <dt>{tr("검증 컨트랙트")}</dt>
        <dd>
          <a
            href={`${NETWORK.explorer}/address/${verifier}`}
            target="_blank"
            rel="noreferrer"
          >
            {short(verifier)} ↗
          </a>
        </dd>
      </dl>
      <div className="studio-public-header">
        <h4>Public inputs</h4>
        <span>
          {proof.publicInputs.length} {tr("필드 · {0}개 값", [fields.length])}
        </span>
      </div>
      <p>
        {tr(
          "수신한 {0}개 필드를 32바이트씩 묶었습니다. 각 값과 원본 필드를 직접 확인할 수 있습니다.",
          [proof.publicInputs.length],
        )}
      </p>
      <div className="studio-public-fields">
        {fields.map((field) => (
          <div className="studio-public-field" key={field.name}>
            <div>
              <strong>{field.name}</strong>
              <span>
                [{field.start}–{field.end}]
              </span>
            </div>
            <p>{tr(field.description)}</p>
            <code>{field.value}</code>
          </div>
        ))}
      </div>
      <details className="studio-raw">
        <summary>
          Proof{" "}
          <span>
            {((proof.proof.length - 2) / 2).toLocaleString()} bytes ·{" "}
            {tr("전체 값")}
          </span>
        </summary>
        <pre tabIndex={0} aria-label="Proof hex">
          {proof.proof}
        </pre>
      </details>
      <details className="studio-raw">
        <summary>
          {tr("Public inputs 원본")}{" "}
          <span>
            {proof.publicInputs.length} {tr("필드")}
          </span>
        </summary>
        <pre tabIndex={0} aria-label={tr("Public inputs 원본")}>
          {JSON.stringify(proof.response.publicInputs, null, 2)}
        </pre>
      </details>
      <details className="studio-raw">
        <summary>{tr("수신 응답 전체 JSON")}</summary>
        <p>
          {tr(
            "SDK에서 받은 응답을 필드 삭제 없이 표시합니다. 위의 조회 주소는 별도로 입력한 값입니다.",
          )}
        </p>
        <pre tabIndex={0} aria-label={tr("수신 응답 전체 JSON")}>
          {raw}
        </pre>
      </details>
      <button
        className="secondary-button"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([raw], { type: "application/json" }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = `${proof.circuit}-response.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        <Download size={15} />
        {tr("수신 JSON 다운로드")}
      </button>
    </section>
  );
}
