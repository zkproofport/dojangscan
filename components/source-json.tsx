import { useState } from "react";
import { usePreferences } from "@/lib/preferences";
import { downloadJSON } from "@/lib/download-json";
/** Raw data is an explicit action, never the record's default content. */
export function SourceJSON({
  value,
  name,
  ko: languageOverride,
}: {
  value: unknown;
  name: string;
  ko?: boolean;
}) {
  const [language] = usePreferences(),
    [open, setOpen] = useState(false);
  const ko = languageOverride ?? language === "ko";
  return (
    <section className="source-json">
      <div className="evidence-actions">
        <button onClick={() => setOpen(!open)} aria-expanded={open}>
          {ko
            ? open
              ? "JSON 닫기"
              : "원본 JSON 보기"
            : open
              ? "Hide JSON"
              : "View source JSON"}
        </button>
        <button onClick={() => downloadJSON(value, name)}>
          {ko ? "JSON 다운로드" : "Download JSON"}
        </button>
      </div>
      {open && <pre>{JSON.stringify(value, null, 2)}</pre>}
    </section>
  );
}
