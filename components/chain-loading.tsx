import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { tr } from "@/lib/i18n";

export function ChainLoading() {
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
    <div className="chain-loading">
      <RefreshCw size={17} className="spinning" aria-hidden="true" />
      <div role="status">
        <strong>
          {tr(
            seconds >= 30
              ? "온체인 정보를 계속 확인하고 있습니다."
              : "온체인 정보를 불러오고 있습니다.",
          )}
        </strong>
        <p>
          {tr(
            "공개 RPC에서 등록·권한·도장 상태를 확인합니다. 첫 조회는 수십 초 이상 걸릴 수 있습니다.",
          )}
        </p>
      </div>
      <span className="chain-loading-time" aria-hidden="true">
        {seconds}s
      </span>
    </div>
  );
}
