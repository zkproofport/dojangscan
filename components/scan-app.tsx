import { invalidateScanCache } from "@/lib/scan-data";
import { PlaygroundInvite } from "./playground-guide";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/preferences";
import { usePreferences, setLanguage, setTheme } from "@/lib/preferences";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Search,
  Wallet,
  Fingerprint,
  Layers,
  ShieldCheck,
  RefreshCw,
  ScanLine,
  LayoutGrid,
  List,
  ArrowRight,
  ChevronDown,
  Download,
  CircleHelp,
  Sun,
  Moon,
  Languages,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import {
  short,
  type Attestation,
  type ScanData,
  type SchemaRecord,
  type Issuer,
} from "@/lib/giwa";
import { getData, CopyButton, Badge, ScanTable, ScanCards } from "./scan-ui";
import ScanDetail, { downloadJSON } from "./scan-detail";
import { connectWallet, injected } from "@/lib/wallet";
import { ChainLoading } from "./chain-loading";
import { trackSection } from "@/lib/analytics";
import { localURL } from "@/lib/navigation";
import { DojangLogo } from "./dojang-logo";
const OperatorHub = lazy(() => import("./operator-hub"));
const ProofStudio = lazy(() => import("./proof-studio"));
const LearningGuide = lazy(() => import("./learning-guide"));
const nav = [
  { id: "explore", label: "도장 탐색", icon: ScanLine },
  { id: "schemas", label: "도장 종류", icon: Layers },
  { id: "issuers", label: "발행자·관리자", icon: ShieldCheck },
  { id: "wallet", label: "내 도장", icon: Wallet },
  { id: "lab", label: "Proof Studio", icon: Fingerprint },
];
type WalletData = ScanData & { address: string; verifiedBy: Issuer[] };
export default function ScanApp() {
  const [language, theme] = usePreferences();
  const [view, setView] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return requested === "workspace"
      ? "issuers"
      : requested &&
          (nav.some((item) => item.id === requested) || requested === "guide")
        ? requested
        : "explore";
  });
  const trackedSection = useRef("");
  useEffect(() => {
    if (trackedSection.current === view) return;
    trackSection(view);
    trackedSection.current = view;
  }, [view]);
  const [data, setData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [filter, setFilter] = useState("dojang");
  const [issuerFilter, setIssuerFilter] = useState("all");
  const [schemaFilter, setSchemaFilter] = useState("all");
  const [display, setDisplay] = useState("cards");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Attestation | null>(null);
  const [schemaDetail, setSchemaDetail] = useState<SchemaRecord | null>(null);
  const [schemaUid, setSchemaUid] = useState("");
  const [schemaBusy, setSchemaBusy] = useState(false);
  const [schemaError, setSchemaError] = useState("");
  const schemaSequence = useRef(0);
  function clearSchema() {
    schemaSequence.current++;
    setSchemaUid("");
    setSchemaDetail(null);
    setSchemaBusy(false);
    setSchemaError("");
  }
  const [walletInput, setWalletInput] = useState("");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [connected, setConnected] = useState("");
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const walletSequence = useRef(0);
  const searchRef = useRef<(v: string) => Promise<unknown>>(async () => {});
  function updateURL(params: Record<string, string>) {
    window.history.replaceState(null, "", localURL(params));
  }
  function navigate(v: string) {
    sequence.current++;
    walletSequence.current++;
    setSearching(false);
    setSearchError("");
    setWalletBusy(false);
    setView(v);
    setDetail(null);
    clearSchema();
    updateURL({ view: v });
  }
  async function refresh() {
    setLoading(true);
    setError("");
    setMoreError("");
    try {
      setData(await getData("overview"));
      setPage(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function openWallet(address: string) {
    sequence.current++;
    setSearching(false);
    setSearchError("");
    const seq = ++walletSequence.current;
    setDetail(null);
    clearSchema();
    setView("wallet");
    setWalletInput(address);
    updateURL({ view: "wallet", address });
    setWalletBusy(true);
    setWalletError("");
    setWalletData(null);
    try {
      const d = await getData<WalletData>("wallet", { address });
      if (seq === walletSequence.current) setWalletData(d);
      return d;
    } catch (e) {
      if (seq === walletSequence.current) setWalletError((e as Error).message);
      throw e;
    } finally {
      if (seq === walletSequence.current) setWalletBusy(false);
    }
  }
  async function openSchema(uid: string) {
    sequence.current++;
    setSearching(false);
    setSearchError("");
    const seq = ++schemaSequence.current;
    setDetail(null);
    setSchemaUid(uid);
    setSchemaDetail(
      data?.schemas.find((s) => s.uid.toLowerCase() === uid.toLowerCase()) ??
        null,
    );
    setSchemaBusy(true);
    setSchemaError("");
    setView("schemas");
    updateURL({ view: "schemas", schema: uid });
    try {
      const result = await getData<SchemaRecord>("schema", { uid });
      if (seq === schemaSequence.current) setSchemaDetail(result);
      return result;
    } catch (e) {
      if (seq === schemaSequence.current) setSchemaError((e as Error).message);
    } finally {
      if (seq === schemaSequence.current) setSchemaBusy(false);
    }
  }
  function openRecord(a: Attestation) {
    sequence.current++;
    setSearching(false);
    setSearchError("");
    clearSchema();
    setDetail(a);
    updateURL({ view, uid: a.uid });
  }
  async function runSearch(value: string) {
    value = value.trim();
    if (!value) {
      setSearchError(tr("지갑 주소·도장 UID·트랜잭션 해시를 입력하세요."));
      return;
    }
    const seq = ++sequence.current;
    setSearching(true);
    setSearchError("");
    try {
      if (/^0x[0-9a-fA-F]{40}$/.test(value)) return await openWallet(value);
      if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
        const found = data?.schemas.find(
          (s) =>
            s.name.toLowerCase().includes(value.toLowerCase()) ||
            s.label.includes(value) ||
            tr(s.label).toLowerCase().includes(value.toLowerCase()),
        );
        if (found) return await openSchema(found.uid);
        throw new Error(
          tr("주소, UID, 트랜잭션 해시 또는 도장 종류 이름을 입력하세요."),
        );
      }
      const found = await getData("search", { value });
      if (seq !== sequence.current) return found;
      if (found.type === "schema") {
        clearSchema();
        setSchemaUid(value);
        setSchemaDetail(found.record);
        setDetail(null);
        setView("schemas");
        updateURL({ view: "schemas", schema: value });
      } else if (found.type === "attestation") {
        setDetail(found.record);
        clearSchema();
        updateURL({ view, uid: value });
      } else {
        setView("explore");
        setFilter("all");
        setSchemaFilter("all");
        setIssuerFilter("all");
        setPage(1);
        const base = data ?? (await getData<ScanData>("overview"));
        if (seq !== sequence.current) return found;
        setData({
          ...base,
          attestations: found.record.attestations.filter(Boolean),
          next: null,
          coverage: tr("트랜잭션 {0}에서 발급된 EAS 기록입니다.", [
            short(value),
          ]),
        });
        updateURL({ view: "explore", tx: value });
        if (!found.record.attestations.length)
          toast.info(tr("이 트랜잭션에는 EAS 발급 기록이 없습니다."));
      }
      return found;
    } catch (e) {
      if (seq === sequence.current) setSearchError((e as Error).message);
    } finally {
      if (seq === sequence.current) setSearching(false);
    }
  }
  searchRef.current = runSearch;
  async function connect() {
    const walletRequest = walletSequence.current;
    setConnecting(true);
    setWalletError("");
    try {
      const { signer } = await connectWallet();
      const address = await signer.getAddress();
      setConnected(address);
      setConnecting(false);
      if (walletRequest === walletSequence.current) await openWallet(address);
    } catch (e) {
      setWalletError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }
  async function loadMore() {
    if (!data?.next) return;
    setMoreBusy(true);
    setMoreError("");
    try {
      const d = await getData<ScanData>("attestations", {
        cursor: JSON.stringify(data.next),
      });
      setData((old) =>
        old
          ? {
              ...d,
              attestations: [...old.attestations, ...d.attestations].filter(
                (a, i, arr) => arr.findIndex((b) => b.uid === a.uid) === i,
              ),
              coverage: tr(
                "추가로 불러온 EAS 로그의 조회 범위입니다. 전체 발급량이 아닙니다.",
              ),
            }
          : d,
      );
    } catch (e) {
      setMoreError((e as Error).message);
    } finally {
      setMoreBusy(false);
    }
  }
  useEffect(() => {
    let live = true;
    void getData<ScanData>("overview")
      .then((d) => {
        if (live) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setLoading(false);
        }
      });
    const q = new URLSearchParams(window.location.search);
    const v = q.get("view");
    if (v === "workspace") {
      setView("issuers");
      updateURL({ view: "issuers", mode: "manage" });
    } else if (v && (nav.some((n) => n.id === v) || v === "guide")) setView(v);
    const query =
      q.get("uid") ?? q.get("schema") ?? q.get("address") ?? q.get("tx");
    if (query) {
      setSearch(query);
      if (q.get("schema")) void openSchema(query);
      else void searchRef.current(query);
    }
    const keyboard = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", keyboard);
    let provider: ReturnType<typeof injected> | undefined;
    const changed = (accounts: unknown) => {
      walletSequence.current++;
      setWalletBusy(false);
      setWalletError("");
      setConnected((accounts as string[])[0] ?? "");
      setWalletData(null);
    };
    try {
      provider = injected();
      provider.on?.("accountsChanged", changed);
    } catch {}
    return () => {
      live = false;
      window.removeEventListener("keydown", keyboard);
      provider?.removeListener?.("accountsChanged", changed);
    };
  }, []);
  useEffect(() => setPage(1), [filter, issuerFilter, schemaFilter]);
  const items =
    data?.attestations.filter(
      (a) =>
        (filter === "all" ||
          (filter === "dojang" ? a.dojang : a.status !== "active")) &&
        (issuerFilter === "all" ||
          (issuerFilter === "manager"
            ? a.managementRole
            : issuerFilter === "registered"
              ? a.registeredIssuer
              : a.issuerClass === issuerFilter)) &&
        (schemaFilter === "all" ||
          a.schema.toLowerCase() === schemaFilter.toLowerCase()),
    ) ?? [];
  const pages = Math.max(1, Math.ceil(items.length / 6));
  const currentPage = Math.min(page, pages);
  const visible = items.slice((currentPage - 1) * 6, currentPage * 6);
  const currentSchemas =
    data?.schemas.filter((s) => s.current && s.registered) ?? [];
  const titles: Record<string, { title: string; text: string }> = {
    explore: {
      title: "Dojang Scan",
      text: tr("GIWA 도장을 검색하고 발행자와 상태를 확인하세요."),
    },
    schemas: {
      title: tr("도장 종류"),
      text: tr(
        "스키마는 도장 내용의 형식입니다. 발급 권한과 데이터의 공개 범위도 함께 봅니다.",
      ),
    },
    issuers: {
      title: tr("발행자와 관리자"),
      text: tr("등록 현황 확인부터 도장 발급과 권한 관리까지."),
    },
    wallet: {
      title: tr("내 도장"),
      text: tr(
        "주소만 입력해 공개된 기록을 확인하세요. 지갑 연결은 선택입니다.",
      ),
    },
    lab: {
      title: "Proof Studio",
      text: tr("개인정보 공개를 줄이는 ZKProofport 증명."),
    },
    guide: {
      title: tr("가이드"),
      text: tr("도장의 구조와 배지의 의미를 몇 가지 예로 살펴봅니다."),
    },
  };
  const heading = titles[view] ?? titles.explore;
  return (
    <div className="app" data-view={view}>
      <Toaster position="bottom-right" theme={theme} />
      <header className="topbar">
        <div className="brand-identity">
          <button className="brand" onClick={() => navigate("explore")}>
            <span className="brand-seal">
              <DojangLogo />
            </span>
            <span>
              Dojang<span className="brand-light"> Scan</span>
            </span>
          </button>
          <a
            className="brand-credit"
            href="https://masselabs.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by <strong>Masse Labs</strong>
          </a>
        </div>
        <nav aria-label={tr("주요 메뉴")}>
          {nav.map((n) => (
            <button
              className={"nav-link " + (view === n.id ? "active" : "")}
              key={n.id}
              aria-current={view === n.id ? "page" : undefined}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={16} />
              {tr(n.label)}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="preference-button"
            onClick={() => setLanguage(language === "ko" ? "en" : "ko")}
            aria-label={
              language === "ko" ? "Switch to English" : tr("한국어로 변경")
            }
          >
            <Languages size={16} />
            {tr(language === "ko" ? "EN" : tr("한국어"))}
          </button>
          <button
            className="preference-button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={theme === "light" ? tr("다크 테마") : tr("라이트 테마")}
          >
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          <button
            className={"help-button " + (view === "guide" ? "active" : "")}
            onClick={() => navigate("guide")}
          >
            <CircleHelp size={17} />
            {tr("가이드")}
          </button>
          <a
            className="giwa-network"
            href="https://giwa.io"
            target="_blank"
            rel="noreferrer"
            aria-label="GIWA · Sepolia"
          >
            <img
              src={`${import.meta.env.BASE_URL}brand/giwa-${theme}.svg`}
              alt="GIWA"
              width="73"
              height="24"
            />
            <span>Sepolia</span>
          </a>
        </div>
        <a
          className="sidebar-credit"
          href="https://masselabs.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Powered by</span>
          <strong>Masse Labs</strong>
        </a>
      </header>
      <main>
        <section
          className={
            "intro " + (view === "explore" ? "explore-intro" : "compact")
          }
        >
          <div>
            <span className="section-kicker">
              {tr(
                view === "explore"
                  ? "GIWA SEPOLIA"
                  : "DOJANG SCAN / " + view.toUpperCase(),
              )}
            </span>
            <h1>
              {tr(heading.title)}
              {view === "explore" && <span className="title-period">.</span>}
            </h1>
            <p>{tr(heading.text)}</p>
          </div>
        </section>
        {loading && view !== "lab" && view !== "guide" && <ChainLoading />}
        {error && view !== "lab" && view !== "guide" && (
          <div className="notice danger" role="alert">
            <p>
              {tr("온체인 정보를 불러오지 못했습니다.")} {tr(error)}
            </p>
            {data && <p>{tr("마지막으로 불러온 정보를 표시합니다.")}</p>}
            <button
              className="secondary-button"
              disabled={loading}
              onClick={refresh}
            >
              {tr("다시 조회")}
            </button>
          </div>
        )}
        {view !== "lab" && view !== "guide" && view !== "issuers" && (
          <form
            className="searchbar"
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(search).catch((e) => toast.error(tr(e.message)));
            }}
          >
            <Search size={20} />
            <input
              aria-label={tr("도장 검색")}
              ref={inputRef}
              placeholder={tr(
                "지갑 주소, 도장 UID, 스키마 이름, 트랜잭션 해시",
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>/</kbd>
            <button disabled={searching}>
              {tr(searching ? tr("조회 중") : tr("검색"))}
            </button>
          </form>
        )}
        {searching && (
          <ChainLoading
            title="검색 중입니다."
            description="입력한 주소나 식별자를 확인하고 있습니다."
          />
        )}
        {searchError && (
          <div className="notice danger" role="alert">
            {tr(searchError)}
          </div>
        )}
        {view === "explore" && (
          <>
            <PlaygroundInvite
              onStart={() => {
                navigate("guide");
                window.scrollTo({ top: 0 });
              }}
            />
            <button className="explore-help" onClick={() => navigate("guide")}>
              <CircleHelp size={16} />
              <span>{tr("EAS와 Dojang, 어떤 관계일까요?")}</span>
              <ArrowRight size={15} />
            </button>
            <div className="overview-line">
              <div>
                <strong>{tr(data?.attestations.length ?? "—")}</strong>
                <span>{tr("조회된 EAS 도장")}</span>
              </div>
              <div>
                <strong>{tr(currentSchemas.length || "—")}</strong>
                <span>{tr("현재 Dojang 스키마")}</span>
              </div>
              <div>
                <strong>{tr(data?.issuers.length ?? "—")}</strong>
                <span>{tr("등록 발행자")}</span>
              </div>
              <span className="sync-status">
                <span className="live-dot" />
                {tr(
                  data
                    ? tr("블록 {0} · {1}", [
                        data.block.toLocaleString(),
                        new Date(data.checkedAt).toLocaleTimeString(
                          getLocale(),
                          { hour: "2-digit", minute: "2-digit" },
                        ),
                      ])
                    : tr("GIWA 조회 중"),
                )}
              </span>
              <button
                className="icon-button"
                aria-label={tr("새로고침")}
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "spinning" : ""} />
              </button>
            </div>
            <section className="browse-section">
              <div className="section-heading bare">
                <div>
                  <h2>{tr("도장 종류")}</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("schemas")}
                >
                  {tr("모든 종류")}
                  <ArrowRight size={15} />
                </button>
              </div>
              <div className="category-rail">
                {currentSchemas.map((s) => (
                  <button
                    className={
                      schemaFilter === s.uid
                        ? "category-tile selected"
                        : "category-tile"
                    }
                    key={s.uid}
                    aria-pressed={schemaFilter === s.uid}
                    onClick={() => {
                      setSchemaFilter(schemaFilter === s.uid ? "all" : s.uid);
                      setFilter("dojang");
                    }}
                  >
                    <span className={"schema-icon " + s.color}>
                      <Layers size={20} />
                    </span>
                    <strong>{tr(s.label)}</strong>
                    <small>{tr(s.name)}</small>
                  </button>
                ))}
              </div>
            </section>
            <section className="records-workspace">
              <div className="section-heading bare">
                <div>
                  <h2>{tr("최근 기록")}</h2>
                </div>
                <div className="display-toggle" aria-label={tr("보기 방식")}>
                  <button
                    aria-label={tr("카드 보기")}
                    className={display === "cards" ? "selected" : ""}
                    onClick={() => setDisplay("cards")}
                  >
                    <LayoutGrid size={17} />
                  </button>
                  <button
                    aria-label={tr("목록 보기")}
                    className={display === "list" ? "selected" : ""}
                    onClick={() => setDisplay("list")}
                  >
                    <List size={17} />
                  </button>
                </div>
              </div>
              <div className="filters-row">
                <div className="pill-buttons">
                  {[
                    { id: "dojang", name: tr("Dojang 스키마") },
                    { id: "all", name: tr("전체 EAS") },
                    { id: "inactive", name: tr("취소·만료") },
                  ].map((f) => (
                    <button
                      key={f.id}
                      className={filter === f.id ? "selected" : ""}
                      onClick={() => setFilter(f.id)}
                    >
                      {tr(f.name)}
                    </button>
                  ))}
                </div>
                <label className="filter-select">
                  {tr("발행자")}
                  <select
                    aria-label={tr("발행자 구분 필터")}
                    value={issuerFilter}
                    onChange={(e) => setIssuerFilter(e.target.value)}
                  >
                    <option value="all">{tr("전체")}</option>
                    <option value="registered">{tr("Dojang 등록")}</option>
                    <option value="manager">{tr("관리 권한 주소")}</option>
                    <option value="playground">{tr("테스트넷 도장")}</option>
                    <option value="test">{tr("ZKProofport 테스트")}</option>
                    <option value="external">{tr("일반 EAS")}</option>
                    <option value="unknown">{tr("미확인")}</option>
                  </select>
                </label>
                {schemaFilter !== "all" && (
                  <button
                    className="clear-filter"
                    onClick={() => setSchemaFilter("all")}
                  >
                    {tr("종류 필터 해제 ×")}
                  </button>
                )}
                <span className="secondary">
                  {tr(items.length)}
                  {tr("개")}
                </span>
                <button
                  className="icon-button"
                  aria-label={tr("조회된 도장 JSON 저장")}
                  disabled={!data}
                  onClick={() => downloadJSON(items, "dojang-records.json")}
                >
                  <Download size={16} />
                </button>
              </div>
              {error && !data ? null : loading && !data ? (
                <Empty title={tr("실제 도장을 읽고 있습니다.")} loading />
              ) : !items.length ? (
                <Empty
                  title={tr("이 범위에는 해당 도장이 없습니다.")}
                  text={tr("전체 EAS를 선택하거나 이전 기록을 불러오세요.")}
                />
              ) : display === "cards" ? (
                <ScanCards items={visible} onSelect={openRecord} />
              ) : (
                <div className="records-panel">
                  <ScanTable items={visible} onSelect={openRecord} />
                </div>
              )}
              {pages > 1 && (
                <div className="record-pagination">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {tr("이전")}
                  </button>
                  <span>
                    {tr(currentPage)} / {tr(pages)}
                  </span>
                  <button
                    disabled={currentPage === pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {tr("다음")}
                  </button>
                </div>
              )}
              {data?.next && (
                <div className="load-more">
                  {moreError && (
                    <p className="notice danger" role="alert">
                      {tr(moreError)}
                    </p>
                  )}
                  {moreBusy && (
                    <ChainLoading title="이전 기록을 불러오고 있습니다." />
                  )}
                  <button
                    className="secondary-button"
                    disabled={moreBusy}
                    onClick={loadMore}
                  >
                    {tr(moreBusy ? tr("조회 중") : tr("이전 기록 더 보기"))}
                    <ChevronDown size={15} />
                  </button>
                </div>
              )}
              <p className="fine-print coverage">
                {tr(data?.coverage)}
                {tr("등록 여부와 유효 상태는 도장 상세에서 확인하세요.")}
              </p>
            </section>
            <section className="studio-banner">
              <div className="banner-icon">
                <Fingerprint size={34} />
              </div>
              <div>
                <span className="section-kicker">ZKPROOFPORT</span>
                <h3>{tr("내 도장으로 ZK 증명")}</h3>
                <p>{tr("ZKProofport 모바일 앱 연동을 준비하고 있습니다.")}</p>
              </div>
              <button className="primary" onClick={() => navigate("lab")}>
                Proof Studio
                <ArrowRight size={16} />
              </button>
            </section>
          </>
        )}
        {view === "schemas" && (
          <section className="view-section">
            <div className="schema-grid">
              {data?.schemas.map((s) => (
                <button
                  className="schema-card"
                  key={s.uid}
                  onClick={() =>
                    void openSchema(s.uid).catch((e) =>
                      toast.error(tr(e.message)),
                    )
                  }
                >
                  <div className="schema-card-top">
                    <span className={"schema-icon " + s.color}>
                      <Layers size={24} />
                    </span>
                    <Badge variant={s.current ? "success" : "neutral"}>
                      {tr(s.current ? tr("현재 Dojang") : tr("이전 버전"))}
                    </Badge>
                  </div>
                  <h3>{tr(s.label)}</h3>
                  <span className="sub-label">{tr(s.name)}</span>
                  <p>{tr(s.description)}</p>
                  <code className="schema-definition">{tr(s.definition)}</code>
                  <div className="card-bottom">
                    <span>
                      {tr(
                        s.revocable
                          ? tr("발행자가 취소 가능")
                          : tr("취소 불가"),
                      )}
                    </span>
                    <span>{tr("구조와 규칙 보기 ↗")}</span>
                  </div>
                </button>
              )) ??
                (error ? null : <Empty title={tr("스키마 조회 중")} loading />)}
            </div>
          </section>
        )}
        {view === "issuers" && (
          <Suspense fallback={<Empty title={tr("화면 준비 중")} loading />}>
            <OperatorHub
              data={data}
              error={error}
              onWallet={(address) => void openWallet(address).catch(() => {})}
              initialManage={
                new URLSearchParams(window.location.search).get("mode") ===
                "manage"
              }
            />
          </Suspense>
        )}
        {view === "wallet" && (
          <section className="view-section">
            <div className="wallet-connect-card">
              <div>
                <Wallet size={24} />
                <h2>{tr("주소만으로도 볼 수 있어요.")}</h2>
                <p>{tr("조회에는 서명이나 가스가 필요 없습니다.")}</p>
              </div>
              <button
                className="primary"
                onClick={connect}
                disabled={connecting || walletBusy}
              >
                {tr(
                  connecting
                    ? "지갑에서 연결을 승인해 주세요."
                    : connected
                      ? short(connected)
                      : "내 지갑 연결",
                )}
              </button>
            </div>
            {connecting && (
              <ChainLoading
                title="지갑 연결을 기다리고 있습니다."
                description="지갑 앱이나 확장 프로그램에서 연결 요청을 확인하세요."
              />
            )}
            <form
              className="wallet-form"
              onSubmit={(e) => {
                e.preventDefault();
                void openWallet(walletInput).catch(() => {});
              }}
            >
              <label htmlFor="wallet-address">{tr("조회할 지갑 주소")}</label>
              <div>
                <input
                  id="wallet-address"
                  value={walletInput}
                  onChange={(e) => setWalletInput(e.target.value)}
                  placeholder="0x…"
                  required
                />
                <button className="primary" disabled={walletBusy}>
                  {tr(walletBusy ? tr("조회 중") : tr("도장 조회"))}
                </button>
              </div>
            </form>
            {walletError && (
              <div className="notice danger" role="alert">
                {tr(walletError)}
              </div>
            )}
            {walletBusy ? (
              <ChainLoading title="도장과 인증 상태를 확인하고 있습니다." />
            ) : walletError ? null : walletData ? (
              <>
                <div className="wallet-summary">
                  <h2>{tr("공개 지갑 기록")}</h2>
                  <div className="wallet-summary-address">
                    <code>{walletData.address}</code>
                    <CopyButton value={walletData.address} />
                  </div>
                  <p>
                    {tr(
                      walletData.verifiedBy.length
                        ? tr("DojangScroll 주소 인증 확인 · {0}", [
                            walletData.verifiedBy
                              .map((i) => tr(i.name))
                              .join(", "),
                          ])
                        : tr(
                            "조회한 등록 발행자 기준 주소 인증이 확인되지 않았습니다.",
                          ),
                    )}
                  </p>
                </div>
                {walletData.attestations.length ? (
                  <ScanCards
                    items={walletData.attestations}
                    onSelect={openRecord}
                  />
                ) : (
                  <Empty
                    title={tr("조회한 기본 인덱스에는 도장이 없습니다.")}
                    text={tr(
                      "발급받은 도장의 UID 또는 트랜잭션 해시로 직접 검색할 수도 있습니다.",
                    )}
                  />
                )}
                <p className="fine-print">{tr(walletData.coverage)}</p>
              </>
            ) : (
              <Empty
                title={tr("누구의 도장이 궁금한가요?")}
                text={tr("지갑 주소를 입력하거나 내 지갑을 연결하세요.")}
              />
            )}
          </section>
        )}
        <Suspense
          fallback={<Empty title={tr("화면을 준비하고 있습니다.")} loading />}
        >
          {view === "lab" && <ProofStudio />}
          {view === "guide" && (
            <LearningGuide
              data={data}
              onWallet={(address) => {
                invalidateScanCache();
                void openWallet(address).catch(() => {});
              }}
            />
          )}
        </Suspense>
        {!!data?.warnings.length && (
          <details className="data-notes">
            <summary>
              {tr("데이터 조회 안내 ·")}
              {tr(data.warnings.length)}
              {tr("건")}
            </summary>
            {data.warnings.map((w) => (
              <p key={w}>{tr(w)}</p>
            ))}
          </details>
        )}
        <footer className="site-footer">
          <div className="footer-main">
            <div>
              <a className="brand-mini" href={localURL({ view: "explore" })}>
                <DojangLogo />
                Dojang Scan
              </a>
              <p>{tr("GIWA Dojang 탐색·관리")}</p>
            </div>
            <nav aria-label={tr("푸터 링크")}>
              <button className="text-button" onClick={() => navigate("guide")}>
                {tr("가이드")}
              </button>
              <a
                href="https://docs.giwa.io/giwa-ecosystem/dojang"
                target="_blank"
                rel="noopener noreferrer"
              >
                Dojang Docs ↗
              </a>
              <a
                href="https://github.com/zkproofport/dojangscan"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub ↗
              </a>
            </nav>
          </div>
          <div className="footer-bottom">
            <a
              className="footer-credit"
              href="https://masselabs.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Powered by <strong>Masse Labs</strong>
            </a>
            <span>GIWA Sepolia · 91342</span>
          </div>
        </footer>
      </main>
      <ScanDetail
        key={schemaUid || detail?.uid || "closed"}
        record={detail}
        schema={schemaDetail}
        schemaUid={schemaUid}
        schemaBusy={schemaBusy}
        schemaError={schemaError}
        retrySchema={() => void openSchema(schemaUid)}
        close={() => {
          setDetail(null);
          clearSchema();
          updateURL({ view });
        }}
        goWallet={(a) =>
          void openWallet(a).catch((e) => toast.error(tr(e.message)))
        }
        goSchema={(u) =>
          void openSchema(u).catch((e) => toast.error(tr(e.message)))
        }
      />
    </div>
  );
}
export function Empty({
  title,
  text,
  loading = false,
  action,
}: {
  title: string;
  text?: string;
  loading?: boolean;
  action?: () => void;
}) {
  return (
    <div className="empty-state" role="status">
      {loading ? (
        <RefreshCw className="spinning" size={24} />
      ) : (
        <ScanLine size={24} />
      )}
      <h3>{tr(title)}</h3>
      {text && <p>{tr(text)}</p>}
      {action && (
        <button className="secondary-button" onClick={action}>
          {tr("다시 조회")}
        </button>
      )}
    </div>
  );
}
