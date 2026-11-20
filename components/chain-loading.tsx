import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { tr } from "@/lib/i18n";

export function ChainLoading({
  title = "온체인 데이터 조회 중",
  description = "공개 RPC 응답 대기 중 · 완료 시 자동 표시",
}: {
  title?: string;
  description?: string;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="chain-loading" aria-busy="true">
      <RefreshCw size={17} className="spinning" aria-hidden="true" />
      <div role="status">
        <strong>{tr(title)}</strong>
        <p>
          {tr(
            seconds >= 30
              ? "응답 지연 · 조회 진행 중"
              : description,
          )}
        </p>
      </div>
      <span className="chain-loading-time" aria-hidden="true">
        {seconds}s
      </span>
    </div>
  );
}
