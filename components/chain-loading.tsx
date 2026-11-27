import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { tr } from "@/lib/i18n";

export function ChainLoading({
  title = "온체인 정보를 불러오고 있습니다.",
  description = "공개 RPC 응답을 기다리고 있습니다. 완료되면 자동으로 표시됩니다.",
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
              ? "응답이 지연되고 있습니다. 아직 조회 중이며, 완료되면 자동으로 표시됩니다."
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
