import { Search, ScanLine, ShieldCheck, Layers } from "lucide-react";
export default function PrimaryNavigation({
  view,
  backend,
  search,
  ko,
}: {
  view: string;
  backend: boolean;
  search: string;
  ko: boolean;
}) {
  return (
    <nav aria-label={ko ? "주요 메뉴" : "Main navigation"}>
      {[
        {
          id: "home",
          label: ko ? "도장 조회" : "Dojang lookup",
          href: "?view=home",
          active:
            view === "home" ||
            (view === "explore" && new URLSearchParams(search).has("uid")),
          icon: Search,
        },
        {
          id: "address",
          label: ko ? "주소 조회" : "Address lookup",
          href: "?view=recipient-records&source=backend",
          active: [
            "wallet",
            "issuer",
            "recipient-records",
            "issuer-records",
          ].includes(view),
          icon: ScanLine,
        },
        {
          id: "issuers",
          label: ko ? "발급·관리" : "Issue & manage",
          href: "?view=issuers&source=public",
          active: view === "issuers",
          icon: ShieldCheck,
        },
        {
          id: "tools",
          label: ko ? "전문 도구" : "Tools",
          href: "?view=tools",
          active:
            ![
              "home",
              "wallet",
              "issuer",
              "recipient-records",
              "issuer-records",
              "issuers",
            ].includes(view) &&
            !(view === "explore" && new URLSearchParams(search).has("uid")),
          icon: Layers,
        },
      ].map((n) => (
        <a
          key={n.id}
          href={n.href}
          className={"nav-link " + (n.active ? "active" : "")}
          aria-current={n.active ? "page" : undefined}
        >
          <n.icon size={18} />
          {n.label}
        </a>
      ))}
    </nav>
  );
}
