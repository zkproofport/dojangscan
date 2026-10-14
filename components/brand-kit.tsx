import { Download, ArrowDownToLine } from "lucide-react";
import { tr } from "@/lib/i18n";

const base = `${import.meta.env.BASE_URL}brand/`;
const variants = [
  { id: "light", label: "밝은 배경용", dark: false },
  { id: "dark", label: "어두운 배경용", dark: true },
  { id: "black", label: "검정 단색", dark: false },
  { id: "white", label: "흰색 단색", dark: true },
];

function Downloads({ name }: { name: string }) {
  return (
    <div className="brand-file-links">
      {["svg", "png"].map((ext) => (
        <a
          key={ext}
          href={`${base}${name}.${ext}`}
          download
          aria-label={`${name}.${ext}`}
        >
          {ext.toUpperCase()}
          <ArrowDownToLine size={14} aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

export default function BrandKit() {
  return (
    <div className="brand-kit">
      <div className="brand-kit-toolbar">
        <p>{tr("로고 · 워드마크 · 소개 이미지 · 사용 안내")}</p>
        <a
          className="primary"
          href={`${base}dojangscan-brand-kit.zip`}
          download
        >
          <Download size={17} aria-hidden="true" />
          {tr("전체 다운로드")}
          <span>ZIP</span>
        </a>
      </div>
      <section aria-label={tr("로고 다운로드")} className="brand-assets-grid">
        {variants.map((variant) => (
          <article className="brand-asset" key={variant.id}>
            <div
              className={`brand-asset-preview ${variant.dark ? "on-dark" : "on-light"}`}
            >
              <img
                src={`${base}dojangscan-wordmark-${variant.id}.svg`}
                alt={`Dojangscan — ${tr(variant.label)}`}
                width="560"
                height="128"
              />
            </div>
            <div className="brand-asset-meta">
              <h2>{tr(variant.label)}</h2>
              <span>SVG · PNG</span>
            </div>
            <div className="brand-asset-row">
              <span>{tr("심볼 + 이름")}</span>
              <Downloads name={`dojangscan-wordmark-${variant.id}`} />
            </div>
            <div className="brand-asset-row">
              <span className="brand-symbol-label">
                <span
                  className={`brand-symbol-thumb ${variant.dark ? "on-dark" : "on-light"}`}
                >
                  <img
                    src={`${base}dojangscan-symbol-${variant.id}.svg`}
                    alt=""
                    width="28"
                    height="28"
                  />
                </span>
                {tr("심볼")}
              </span>
              <Downloads name={`dojangscan-symbol-${variant.id}`} />
            </div>
          </article>
        ))}
      </section>
      <section className="brand-cover-section" aria-label={tr("소개 이미지")}>
        <img
          src={`${base}dojangscan-cover.png`}
          alt={tr(
            "Dojangscan 소개 이미지 — GIWA 도장 조회와 관리. Powered by Masse Labs.",
          )}
          width="1280"
          height="720"
          loading="lazy"
        />
        <div>
          <h2>{tr("소개 이미지")}</h2>
          <p>{tr("프로젝트 소개, 제품 목록, 발표 자료에 사용하세요.")}</p>
          <p className="fine-print">1280 × 720 · PNG</p>
          <a
            className="secondary-button"
            href={`${base}dojangscan-cover.png`}
            download
          >
            <Download size={16} aria-hidden="true" />
            {tr("이미지 다운로드")}
          </a>
        </div>
      </section>
      <section className="brand-guidelines" aria-label={tr("사용 안내")}>
        <div>
          <h2>{tr("이름과 표기")}</h2>
          <p>
            {tr(
              "Dojangscan으로 붙여 씁니다. D만 대문자로 표기합니다. 심볼과 글자의 비율, 색상, 간격을 유지해 주세요.",
            )}
          </p>
          <p>
            {tr(
              "로고 주변에는 심볼 너비의 ¼ 이상 여백을 두고, 사진 위에서는 단색 로고와 충분한 대비를 사용하세요.",
            )}
          </p>
          <a href={`${base}brand-guidelines.txt`} download>
            {tr("사용 안내 다운로드")} ↓
          </a>
        </div>
        <div>
          <h2>{tr("브랜드 색상")}</h2>
          <div className="brand-palette">
            {[
              { name: "Ink", hex: "#1D1D1F" },
              { name: "Stamp", hex: "#B84536" },
              { name: "Coral", hex: "#F29280" },
              { name: "Paper", hex: "#F5F5F7" },
            ].map((color) => (
              <div key={color.name}>
                <span style={{ background: color.hex }} />
                <strong>{color.name}</strong>
                <code>{color.hex}</code>
              </div>
            ))}
          </div>
          <p>
            {tr("이름은 단색으로, 도장 심볼은 밝은 배경에서 Stamp, 어두운 배경에서 Coral로 표시합니다.")}
          </p>
        </div>
      </section>
    </div>
  );
}
