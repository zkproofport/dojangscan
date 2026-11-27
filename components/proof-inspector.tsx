import { Download } from "lucide-react";
import { tr } from "../lib/i18n";
import { NETWORK, short } from "../lib/giwa";
import { STUDIO_PROFILES, type StudioProof } from "../lib/proof-studio";

export function ProofInspector({ proof }: { proof: StudioProof }) {
  const verifier = STUDIO_PROFILES[proof.circuit].verifier;
  const raw = JSON.stringify(proof.response, null, 2);
  return (
    <div className="studio-evidence">
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
    </div>
  );
}
