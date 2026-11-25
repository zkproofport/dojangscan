import { useId, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Search } from "lucide-react";
import { usePreferences } from "@/lib/preferences";
import {
  resolveProductLookup,
  isIssuerAddress,
  addressRoleURL,
} from "@/lib/product-experience";

// Saved public response: tests/fixtures/real-public-records.json, dojang-detail.
// The server's Dojang classification is not a current eligibility decision.
export const HOME_RECORD_UID =
  "0x000f5defabca90f7500181b4c06aaa6113c8b7a6f8e6734b26b605558de5f9e7";

export function HomeContent({ ko }: { ko: boolean }) {
  const t = (a: string, b: string) => (ko ? a : b);
  const id = useId();
  const [input, setInput] = useState("");
  const [role, setRole] = useState<"wallet" | "issuer">("wallet");
  const [invalid, setInvalid] = useState(false);
  const address = isIssuerAddress(input);
  const target = resolveProductLookup(
    input,
    address ? role : "record",
    address ? "recent" : "backend",
  );
  return (
    <div className="dojang-home">
      <section className="dojang-hero" aria-labelledby={`${id}-title`}>
        <div className="dojang-hero-main">
          <div className="dojang-home-brand">
            <span>Dojangscan</span>
            <span>GIWA Sepolia</span>
          </div>
          <header>
            <h1 id={`${id}-title`}>
              {t("도장 기록 조회", "Dojang record lookup")}
            </h1>
            <p>
              {t(
                "도장 UID 또는 지갑 주소로 발급 내역과 기록 내용을 확인합니다.",
                "Look up issuance history and available record content by Dojang UID or wallet address.",
              )}
            </p>
          </header>
          <form
            className="dojang-search"
            onSubmit={(event) => {
              event.preventDefault();
              setInvalid(!target);
              if (target) location.href = target.href;
            }}
          >
            <label htmlFor={id}>
              {t("도장 UID 또는 지갑 주소", "Dojang UID or wallet address")}
            </label>
            <div className="dojang-search-field" data-invalid={invalid}>
              <Search size={20} aria-hidden="true" />
              <input
                id={id}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setInvalid(false);
                }}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
                aria-invalid={invalid}
                aria-describedby={invalid ? `${id}-error` : `${id}-hint`}
                placeholder={t(
                  "도장 UID 또는 지갑 주소 입력",
                  "Enter a Dojang UID or wallet address",
                )}
              />
            </div>
            {address && (
              <div
                className="dojang-search-roles"
                role="group"
                aria-label={t("주소 조회 구분", "Address lookup type")}
              >
                <button
                  type="button"
                  aria-pressed={role === "wallet"}
                  onClick={() => setRole("wallet")}
                >
                  {t("수신 내역", "Received records")}
                </button>
                <button
                  type="button"
                  aria-pressed={role === "issuer"}
                  onClick={() => setRole("issuer")}
                >
                  {t("발급 내역", "Issued records")}
                </button>
              </div>
            )}
            {invalid && (
              <p
                id={`${id}-error`}
                className="dojang-search-error"
                role="alert"
              >
                {t(
                  "주소(0x와 40자리), UID(0x와 64자리) 또는 Dojangscan 공유 링크를 입력하세요.",
                  "Enter an address (40 hex digits), UID (64 hex digits) or Dojangscan share link.",
                )}
              </p>
            )}
            <div className="dojang-search-submit">
              <button type="submit" disabled={!input.trim()}>
                {address
                  ? role === "wallet"
                    ? t("받은 기록 조회", "View received records")
                    : t("발급한 기록 조회", "View issued records")
                  : t("도장 조회", "Look up Dojang")}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <p id={`${id}-hint`}>
                {t("지갑 연결 없이 조회", "No wallet connection needed")}
              </p>
            </div>
          </form>
        </div>
        <aside
          className="dojang-home-feature"
          aria-label={t("실제 기록 예시", "Example record")}
        >
          <div className="dojang-seal-art" aria-hidden="true">
            <svg
              className="dojang-seal-lines"
              viewBox="0 0 320 280"
              fill="none"
            >
              <rect x="68" y="48" width="184" height="184" rx="46" />
              <rect x="52" y="32" width="216" height="216" rx="55" />
              <path d="M30 74V22h52M238 22h52v52M30 206v52h52M238 258h52v-52M160 12v20M160 248v20M12 140h40M268 140h40" />
            </svg>
            <img
              className="dojang-home-mark-light"
              src="brand/dojangscan-symbol-light.svg"
              width="104"
              height="104"
              alt=""
            />
            <img
              className="dojang-home-mark-dark"
              src="brand/dojangscan-symbol-dark.svg"
              width="104"
              height="104"
              alt=""
            />
          </div>
          <a
            className="dojang-sample"
            href={`?view=explore&source=backend&uid=${HOME_RECORD_UID}`}
          >
            <span className="dojang-sample-kicker">
              {t("실제 기록 살펴보기", "Explore a real record")}
              <ArrowUpRight size={20} aria-hidden="true" />
            </span>
            <strong>
              {t("주소 인증 형식", "Address verification format")}
            </strong>
            <span className="dojang-sample-description">
              {t(
                "발행자, 수신자와 발급 상태 조회",
                "View the issuer, recipient and issuance state",
              )}
            </span>
            <span className="dojang-sample-scope">
              {t(
                "저장된 Dojang 분류 · 현재 이용 자격 미확인",
                "Stored Dojang classification · current eligibility unconfirmed",
              )}
            </span>
          </a>
        </aside>
      </section>
      <nav
        className="dojang-address-actions"
        aria-label={t("주소로 조회", "Look up by address")}
      >
        <a href={addressRoleURL(input, true)}>
          <span className="dojang-action-icon">
            <ArrowDownLeft size={24} aria-hidden="true" />
          </span>
          <span>
            <strong>{t("받은 도장 조회", "Received Dojang")}</strong>
            <span>
              {t(
                "지갑 주소로 수신 기록 확인",
                "Find records received by a wallet",
              )}
            </span>
          </span>
          <ArrowRight
            className="dojang-action-arrow"
            size={20}
            aria-hidden="true"
          />
        </a>
        <a href={addressRoleURL(input, false)}>
          <span className="dojang-action-icon">
            <ArrowUpRight size={24} aria-hidden="true" />
          </span>
          <span>
            <strong>{t("발급한 기록 조회", "Issued records")}</strong>
            <span>
              {t(
                "발행자 주소로 발급 이력 확인",
                "Find issuance history by issuer address",
              )}
            </span>
          </span>
          <ArrowRight
            className="dojang-action-arrow"
            size={20}
            aria-hidden="true"
          />
        </a>
      </nav>
    </div>
  );
}

export default function ProductHome() {
  const [language] = usePreferences();
  return <HomeContent ko={language === "ko"} />;
}
