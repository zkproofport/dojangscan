import { tr } from "@/lib/i18n";
import {
  ArrowRight,
  Layers3,
  Stamp,
  ScanEye,
  ChevronRight,
} from "lucide-react";
export function Relationship({
  full = false,
  onGuide,
}: {
  full?: boolean;
  onGuide?: () => void;
}) {
  return (
    <section className={"relationship " + (full ? "full" : "")}>
      <div className="relationship-caption">
        <span className="section-kicker">
          {tr("EAS와 Dojang, 어떤 관계일까요?")}
        </span>
        {onGuide && (
          <button className="text-button" onClick={onGuide}>
            {tr("처음 보는 분을 위한 안내")}
            <ChevronRight size={15} />
          </button>
        )}
      </div>
      <div className="relationship-flow">
        <div>
          <Layers3 size={21} />
          <span>
            <strong>EAS</strong>
            <small>{tr("스키마·발급·취소 계약")}</small>
          </span>
        </div>
        <ArrowRight className="flow-arrow" size={18} />
        <div>
          <Stamp size={21} />
          <span>
            <strong>Dojang</strong>
            <small>{tr("EAS 위의 발급·조회 규칙")}</small>
          </span>
        </div>
        <ArrowRight className="flow-arrow" size={18} />
        <div>
          <ScanEye size={21} />
          <span>
            <strong>Dojang Scan</strong>
            <small>{tr("조회·검증·작업 도구")}</small>
          </span>
        </div>
      </div>
      {full && (
        <p>
          {tr(
            "같은 EAS를 사용해도 모든 기록이 Dojang은 아닙니다. Dojang은 등록된 스키마와 발행자, resolver라는 발급 규칙을 함께 사용합니다.",
          )}
        </p>
      )}
    </section>
  );
}
