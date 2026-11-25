import { usePreferences } from "@/lib/preferences";
export default function ToolDirectory() {
  const [language] = usePreferences();
  const ko = language === "ko";
  const tools = [
    [
      "?view=explore&source=backend&history=recent&catalog=events",
      "Recent 이벤트",
      "Recent EAS activity",
      "EAS·Indexer의 이벤트와 거래 근거",
      "EAS and Indexer events with transaction evidence",
    ],
    [
      "?view=schemas&source=public",
      "도장 종류·규칙",
      "Schemas and rules",
      "등록된 형식과 발급 규칙",
      "Registered formats and issuance rules",
    ],
    [
      "?view=codes&source=public",
      "사용처별 조회",
      "Browse by use case",
      "코드 인증 기록과 전달받은 코드 확인",
      "Code records and received-code verification",
    ],
    [
      "?view=lab&source=public",
      "Proof Studio",
      "Proof Studio",
      "테스트넷 도장 기반 증명",
      "Proofs from testnet attestations",
    ],
    [
      "?view=issuers&source=public&tool=console",
      "Contract Console",
      "Contract Console",
      "ABI 기반 조회·실행 · 쓰기는 서명 필요",
      "ABI reads and execution · writes require signing",
    ],
    [
      "?view=explore&source=backend",
      "Dojang·EAS 분류별 조회",
      "Browse classified records",
      "수집·평가된 범위의 관측 결과",
      "Observations within indexed and evaluated coverage",
    ],
    [
      "?view=explore&source=public",
      "EAS 탐색",
      "EAS explorer",
      "공개 RPC·Explorer에서 직접 확인",
      "Read public RPC and Explorer data",
    ],
    [
      "?view=explore&source=backend&history=backfill",
      "과거 이력",
      "Historical records",
      "별도 보관된 이벤트와 증거",
      "Separately stored events and evidence",
    ],
    [
      "?view=guide",
      "가이드",
      "Guide",
      "상태·증거와 도구 사용 안내",
      "States, evidence and tool guidance",
    ],
    [
      "?view=brand",
      "브랜드 킷",
      "Brand kit",
      "로고와 브랜드 자료",
      "Logos and brand assets",
    ],
  ];
  return (
    <section
      className="tool-directory"
      aria-label={ko ? "조회·전문 도구" : "Lookup and specialist tools"}
    >
      {tools.map(([href, a, b, c, d]) => (
        <a key={href} href={href}>
          <strong>{ko ? a : b}</strong>
          <span>{ko ? c : d}</span>
        </a>
      ))}
    </section>
  );
}
