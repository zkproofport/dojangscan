import { lazy, Suspense, useEffect, useState } from "react";
import {
  AbiCoder,
  ParamType,
  ZeroAddress,
  ZeroHash,
  id as hashId,
  solidityPackedKeccak256,
} from "ethers";
import { tr } from "@/lib/i18n";
import { getLocale } from "@/lib/preferences";
import { CONTRACTS, NETWORK, short, type ScanData } from "@/lib/giwa";
import { connectWallet, addGiwa, injected } from "@/lib/wallet";
import { walletState, explainError } from "@/lib/transactions";
import {
  prepareCall,
  inspectCapabilities,
  inspectContractRole,
  signOffchain,
  readSchema,
  readOffchainStatus,
  encodeFields,
  type PreparedCall,
} from "@/lib/workspace";
import { inspectOffchain } from "@/lib/offchain";
import { createOffchainExample } from "@/lib/examples";
import { Badge } from "./scan-ui";
import { TransactionHistory } from "./transaction-history";
import { TransactionReview } from "./transaction-review";
import { downloadJSON } from "./scan-detail";
const BalanceStudio = lazy(() => import("./balance-studio"));
const ContractConsole = lazy(() => import("./contract-console"));
const roles = [
  [
    "reader",
    "조회 사용자",
    "도장과 발행자를 확인하고 테스트 발급을 시작합니다.",
  ],
  ["issuer", "발행자", "지갑으로 도장을 발급하고 취소합니다."],
  ["admin", "관리자", "발행자·스키마 등록과 resolver·역할 권한을 관리합니다."],
  [
    "builder",
    "오프체인 발행",
    "EIP-712 문서를 서명하고 타임스탬프·취소를 등록합니다.",
  ],
  ["zk", "ZK 개발", "서명된 잔액을 실제 ZK proof로 만들고 검증합니다."],
  ["console", "Contract Console", "계약 ABI로 함수를 조회하고 실행합니다."],
];
const options: Record<string, string[][]> = {
  issuer: [
    ["attest", "도장 발급"],
    ["revoke", "도장 취소"],
    ["schema", "EAS 스키마 등록"],
  ],
  admin: [
    ["issuer", "발행자 등록"],
    ["issuer-remove", "발행자 등록 해제"],
    ["book-schema", "Dojang 스키마 등록"],
    ["schema-remove", "Dojang 스키마 등록 해제"],
    ["allow", "Resolver 발급 허용"],
    ["disallow", "Resolver 발급 허용 해제"],
    ["grant", "역할 부여"],
    ["role-revoke", "역할 회수"],
    ["indexer", "Resolver indexer 변경"],
    ["balance-root", "잔액 root 스키마 변경"],
  ],
  builder: [
    ["offchain", "오프체인 문서 서명"],
    ["timestamp", "오프체인 UID 타임스탬프"],
    ["offchain-revoke", "오프체인 UID 취소"],
  ],
};
const adminContracts = [
  "SchemaBook",
  "DojangAttesterBook",
  "AddressDojangResolver",
  "BalanceRootDojangResolver",
  "BalanceDojangResolver",
  "VerifyCodeDojangResolver",
];
export default function Workspace({
  data,
  onNavigate,
}: {
  data: ScanData | null;
  onNavigate: (view: string) => void;
}) {
  const [role, setRole] = useState("reader"),
    [operation, setOperation] = useState("attest"),
    [connected, setConnected] = useState(""),
    [chain, setChain] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [definition, setDefinition] = useState("bool completedCourse"),
    [values, setValues] = useState("[true]"),
    [recipient, setRecipient] = useState(""),
    [schema, setSchema] = useState(""),
    [identifier, setIdentifier] = useState(""),
    [target, setTarget] = useState(""),
    [roleId, setRoleId] = useState(ZeroHash),
    [book, setBook] = useState("DojangAttesterBook"),
    [resolver, setResolver] = useState(ZeroAddress),
    [revocable, setRevocable] = useState(true),
    [refUID, setRefUID] = useState(""),
    [expiration, setExpiration] = useState("0");
  const [call, setCall] = useState<PreparedCall | null>(null),
    [capabilities, setCapabilities] = useState<Awaited<
      ReturnType<typeof inspectCapabilities>
    > | null>(null),
    [contractRole, setContractRole] = useState<Awaited<
      ReturnType<typeof inspectContractRole>
    > | null>(null),
    [schemaStatus, setSchemaStatus] = useState("");
  const [document, setDocument] = useState(""),
    [documentIssuer, setDocumentIssuer] = useState(""),
    [status, setStatus] = useState<Awaited<
      ReturnType<typeof readOffchainStatus>
    > | null>(null),
    [checked, setChecked] = useState<ReturnType<typeof inspectOffchain> | null>(
      null,
    );
  const reset = () => {
    setCall(null);
    setError("");
    setSchemaStatus("");
  };
  const edit = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    reset();
  };
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let provider: ReturnType<typeof injected> | undefined;
    let live = true;
    const changed = () => {
      setConnected("");
      setChain(0);
      setCapabilities(null);
      setContractRole(null);
      setCall(null);
      void walletState()
        .then((s) => {
          if (live) {
            setConnected(s.address);
            setChain(s.chain);
          }
        })
        .catch(() => {});
    };
    try {
      provider = injected();
      provider.on?.("accountsChanged", changed);
      provider.on?.("chainChanged", changed);
      changed();
    } catch {}
    return () => {
      live = false;
      provider?.removeListener?.("accountsChanged", changed);
      provider?.removeListener?.("chainChanged", changed);
    };
  }, []);
  async function connect() {
    const { signer } = await connectWallet();
    const state = await walletState();
    setConnected(await signer.getAddress());
    setChain(state.chain);
    if (!recipient) setRecipient(state.address);
    setCall(null);
    setCapabilities(null);
    setContractRole(null);
  }
  function choose(v: string) {
    setRole(v);
    setOperation(
      v === "admin" ? "issuer" : v === "builder" ? "offchain" : "attest",
    );
    if (v === "admin") setBook("DojangAttesterBook");
    setCapabilities(null);
    setContractRole(null);
    reset();
  }
  function chooseOperation(v: string) {
    setOperation(v);
    if (["issuer", "issuer-remove"].includes(v)) setBook("DojangAttesterBook");
    if (["book-schema", "schema-remove"].includes(v)) setBook("SchemaBook");
    if (v === "balance-root") setBook("BalanceDojangResolver");
    if (
      ["allow", "disallow", "indexer"].includes(v) &&
      !book.endsWith("Resolver")
    )
      setBook("AddressDojangResolver");
    setContractRole(null);
    reset();
  }
  function input() {
    return {
      definition,
      values,
      recipient,
      schema,
      id: identifier,
      target,
      role: roleId,
      expiration,
      book,
      resolver,
      revocable,
      refUID,
    };
  }
  async function prepare() {
    const prepared = prepareCall(operation, input());
    if (operation === "attest") {
      const record = await readSchema(schema);
      if (!record.exists) throw new Error("Register this schema first.");
      if (record.definition !== definition)
        throw new Error("Schema definition differs from the onchain record.");
      if (!record.revocable && revocable)
        throw new Error("This schema is irrevocable.");
      setResolver(record.resolver);
    }
    if (operation === "schema") {
      const uid = solidityPackedKeccak256(
        ["string", "address", "bool"],
        [definition, resolver, revocable],
      );
      setSchema(uid);
      if ((await readSchema(uid)).exists) {
        setSchemaStatus(
          tr("이미 등록된 스키마입니다. 이 UID로 바로 발급할 수 있습니다."),
        );
        return;
      }
      setSchemaStatus("UID " + uid);
    }
    setCall(prepared);
  }
  function useSchema(s: {
    uid: string;
    definition: string;
    resolver: string;
    revocable: boolean;
  }) {
    setSchema(s.uid);
    setDefinition(s.definition);
    setResolver(s.resolver);
    setRevocable(s.revocable);
    setValues(defaultValues(s.definition));
    reset();
  }
  function testStart() {
    choose("issuer");
    setOperation("schema");
    setDefinition("bool completedCourse");
    setValues("[true]");
    setResolver(ZeroAddress);
    setRevocable(true);
    setExpiration("0");
    setRefUID("");
    setSchema(
      solidityPackedKeccak256(
        ["string", "address", "bool"],
        ["bool completedCourse", ZeroAddress, true],
      ),
    );
    if (connected) setRecipient(connected);
  }
  async function sign() {
    if (resolver !== ZeroAddress || !revocable)
      throw new Error("This signing form uses resolver=0 and revocable=true.");
    const { signer } = await connectWallet();
    const result = await signOffchain(
      signer,
      definition,
      values,
      recipient,
      expiration,
    );
    setDocument(JSON.stringify(result, null, 2));
    setDocumentIssuer(result.attester);
    setIdentifier(result.uid);
    setChecked(inspectOffchain(result, result.attester));
    setStatus(null);
  }
  return (
    <section className="view-section workspace">
      <div className="workspace-wallet">
        <div>
          <Badge variant={connected ? "success" : "neutral"}>
            {tr(connected ? "연결됨" : "지갑 미연결")}
          </Badge>
          <code>
            {connected
              ? short(connected, 10)
              : tr("조회·예제에는 지갑이 필요 없습니다.")}
          </code>
          <small>
            {connected
              ? `${chain === NETWORK.chainId ? "GIWA Sepolia" : tr("다른 네트워크")} · ${chain}`
              : tr("실행 시 연결 지갑의 승인을 받습니다.")}
          </small>
        </div>
        <div className="example-actions">
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void run(connect)}
          >
            {tr("지갑 연결")}
          </button>
          {connected && chain !== NETWORK.chainId && (
            <button
              className="primary"
              onClick={() =>
                void run(async () => {
                  await addGiwa();
                  setChain((await walletState()).chain);
                })
              }
            >
              {tr("GIWA로 변경")}
            </button>
          )}
        </div>
      </div>
      <TransactionHistory />
      <div className="role-picker">
        {roles.map(([v, t, d]) => (
          <button
            key={v}
            className={role === v ? "selected" : ""}
            onClick={() => choose(v)}
          >
            <strong>{tr(t)}</strong>
            <small>{tr(d)}</small>
          </button>
        ))}
      </div>
      {role === "reader" ? (
        <div className="reader-workspace">
          <div className="studio-panel">
            <Badge variant="blue">{tr("도장 이해하기")}</Badge>
            <h3>{tr("누가, 누구에게, 어떤 사실을 발급했나요?")}</h3>
            <p>
              {tr(
                "EAS는 서명된 사실을 기록하는 공통 시스템입니다. Dojang은 GIWA의 스키마·발행자 목록·발급 규칙을 그 위에 더합니다.",
              )}
            </p>
            <div className="reader-actions">
              {[
                ["explore", "실제 도장", "UID·지갑·트랜잭션 검색"],
                ["schemas", "도장 종류", "공개 필드와 발급 규칙"],
                ["issuers", "발행자·관리자", "현재 등록과 관리 권한"],
              ].map(([v, t, d]) => (
                <button
                  className="schema-card"
                  key={v}
                  onClick={() => onNavigate(v)}
                >
                  <h3>{tr(t)}</h3>
                  <p>{tr(d)}</p>
                </button>
              ))}
            </div>
            <p className="notice">
              {tr(
                "Dojang 등록, 관리자 권한, resolver 발급 허용은 서로 다릅니다. 등록 배지만으로 사실의 진위를 보장하지 않습니다.",
              )}
            </p>
          </div>
          <div className="studio-panel">
            <h3>{tr("내 지갑으로 테스트 도장 발급")}</h3>
            <ol className="guided-steps">
              <li>
                {tr(
                  "기존 GIWA EAS에서 completedCourse 스키마를 조회하거나 등록합니다.",
                )}
              </li>
              <li>{tr("내 주소에 completedCourse=true를 발급합니다.")}</li>
              <li>
                {tr("영수증 UID를 열어 확인하고, 발행 지갑으로 취소해 봅니다.")}
              </li>
            </ol>
            <p>
              {tr(
                "새 EAS 계약은 필요 없습니다. 일반 테스트 도장이며 GIWA 공식 발행 도장이 아닙니다.",
              )}
            </p>
            <button className="primary" onClick={testStart}>
              {tr("테스트 발급 시작")}
            </button>
            <button className="text-button" onClick={() => choose("zk")}>
              {tr("지갑 없이 ZK 예제 실행")}
            </button>
          </div>
        </div>
      ) : role === "zk" ? (
        <Suspense fallback={<p>{tr("화면 준비 중")}</p>}>
          <BalanceStudio
            initialDocument={document}
            initialIssuer={documentIssuer}
            address={connected}
            chain={chain}
          />
        </Suspense>
      ) : role === "console" ? (
        <Suspense fallback={<p>{tr("화면 준비 중")}</p>}>
          <ContractConsole address={connected} chain={chain} />
        </Suspense>
      ) : (
        <div className="studio-grid">
          <div className="studio-panel">
            <h3>
              {tr(
                role === "admin"
                  ? "Dojang 관리"
                  : role === "builder"
                    ? "오프체인 발행"
                    : "온체인 발급",
              )}
            </h3>
            {role === "admin" && (
              <p className="notice">
                {tr(
                  "Book 등록은 목록을 바꾸고, resolver 허용은 실제 발급을 허용합니다. 각각 다른 계약의 관리자 권한과 트랜잭션이 필요합니다.",
                )}
              </p>
            )}
            <label className="input-label">
              {tr("실행 작업")}
              <select
                className="form-input"
                value={operation}
                onChange={(e) => chooseOperation(e.target.value)}
              >
                {options[role].map(([v, t]) => (
                  <option key={v} value={v}>
                    {tr(t)}
                  </option>
                ))}
              </select>
            </label>
            {role === "admin" && (
              <>
                <label className="input-label">
                  {tr("관리 계약")}
                  <select
                    className="form-input"
                    value={book}
                    disabled={[
                      "issuer",
                      "issuer-remove",
                      "book-schema",
                      "schema-remove",
                      "balance-root",
                    ].includes(operation)}
                    onChange={(e) => {
                      setBook(e.target.value);
                      setContractRole(null);
                      reset();
                    }}
                  >
                    {adminContracts
                      .filter(
                        (k) =>
                          !["allow", "disallow", "indexer"].includes(
                            operation,
                          ) || k.endsWith("Resolver"),
                      )
                      .map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                  </select>
                </label>
                <Field
                  label="Role ID"
                  value={roleId}
                  setValue={(v) => {
                    edit(setRoleId)(v);
                    setContractRole(null);
                  }}
                />
                <div className="example-actions">
                  <button
                    className="text-button"
                    onClick={() => {
                      setRoleId(ZeroHash);
                      setContractRole(null);
                      reset();
                    }}
                  >
                    DEFAULT_ADMIN_ROLE
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setRoleId(
                        hashId("dojang." + book.toLowerCase() + ".upgrader"),
                      );
                      setContractRole(null);
                      reset();
                    }}
                  >
                    UPGRADER_ROLE
                  </button>
                </div>
                <button
                  className="secondary-button"
                  disabled={busy || !connected}
                  onClick={() =>
                    void run(async () => {
                      setContractRole(
                        await inspectContractRole(book, connected, roleId),
                      );
                      setCapabilities(
                        await inspectCapabilities(connected, "", roleId),
                      );
                    })
                  }
                >
                  {tr("내 관리 권한 조회")}
                </button>
                <p className="fine-print">
                  {tr(
                    "등록·resolver 설정에는 DEFAULT_ADMIN_ROLE이 필요합니다. 역할 부여·회수에는 getRoleAdmin(선택 역할)의 권한이 필요합니다.",
                  )}
                </p>
              </>
            )}
            {["schema", "attest", "offchain"].includes(operation) && (
              <>
                <Field
                  label={tr("스키마 형식")}
                  value={definition}
                  setValue={edit(setDefinition)}
                />
                <SchemaFields
                  definition={definition}
                  values={values}
                  setValues={edit(setValues)}
                />
                <div className="example-actions">
                  <button
                    className="text-button"
                    onClick={() => {
                      setDefinition("bool completedCourse");
                      setValues("[true]");
                      reset();
                    }}
                  >
                    {tr("수료 여부 예제")}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setDefinition("uint256 balanceKRW");
                      setValues('["1000000"]');
                      setExpiration(
                        String(Math.floor(Date.now() / 1000) + 3600),
                      );
                      reset();
                    }}
                  >
                    {tr("잔액 예제")}
                  </button>
                </div>
              </>
            )}
            {operation === "schema" && (
              <>
                <Field
                  label="Resolver"
                  value={resolver}
                  setValue={edit(setResolver)}
                />
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={revocable}
                    onChange={(e) => {
                      setRevocable(e.target.checked);
                      reset();
                    }}
                  />
                  {tr("취소 가능")}
                </label>
                <p className="fine-print">
                  {tr(
                    "resolver=0은 누구나 발급 가능한 일반 EAS 스키마입니다. 공식 Dojang 편입은 별도 관리자 등록입니다.",
                  )}
                </p>
              </>
            )}
            {operation === "attest" && (
              <>
                <label className="input-label">
                  {tr("현재 Dojang 스키마")}
                  <select
                    className="form-input"
                    value=""
                    onChange={(e) => {
                      const record = data?.schemas.find(
                        (s) => s.uid === e.target.value,
                      );
                      if (record) useSchema(record);
                    }}
                  >
                    <option value="">
                      {tr("선택 또는 아래 UID 직접 입력")}
                    </option>
                    {data?.schemas
                      .filter((s) => s.current)
                      .map((s) => (
                        <option key={s.uid} value={s.uid}>
                          {tr(s.label)}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
            {["attest", "revoke", "book-schema", "balance-root"].includes(
              operation,
            ) && (
              <>
                <Field
                  label="EAS Schema UID"
                  value={schema}
                  setValue={edit(setSchema)}
                />
                {operation === "attest" && (
                  <button
                    className="text-button"
                    disabled={busy || !schema}
                    onClick={() =>
                      void run(async () => {
                        const record = await readSchema(schema);
                        if (!record.exists)
                          throw new Error("Schema not found.");
                        useSchema(record);
                        setSchemaStatus(tr("온체인 스키마 확인 완료"));
                      })
                    }
                  >
                    {tr("UID에서 형식 불러오기")}
                  </button>
                )}
              </>
            )}
            {["attest", "offchain"].includes(operation) && (
              <>
                <Field
                  label={tr("수신 지갑")}
                  value={recipient}
                  setValue={edit(setRecipient)}
                />
                <button
                  className="text-button"
                  disabled={!connected}
                  onClick={() => edit(setRecipient)(connected)}
                >
                  {tr("내 지갑 사용")}
                </button>
                <Expiry value={expiration} setValue={edit(setExpiration)} />
                {operation === "attest" && (
                  <>
                    <Field
                      label="refUID (optional)"
                      value={refUID}
                      setValue={edit(setRefUID)}
                    />
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={revocable}
                        onChange={(e) => {
                          setRevocable(e.target.checked);
                          reset();
                        }}
                      />
                      {tr("취소 가능")}
                    </label>
                    <p className="notice">
                      {tr(
                        "온체인 발급 내용은 공개됩니다. 개인정보나 원본 증명서를 입력하지 마세요.",
                      )}
                    </p>
                  </>
                )}
              </>
            )}
            {[
              "issuer",
              "issuer-remove",
              "book-schema",
              "schema-remove",
              "revoke",
              "timestamp",
              "offchain-revoke",
            ].includes(operation) && (
              <Field
                label={tr(
                  ["revoke", "timestamp", "offchain-revoke"].includes(operation)
                    ? "Attestation UID"
                    : "등록 ID (bytes32)",
                )}
                value={identifier}
                setValue={edit(setIdentifier)}
              />
            )}
            {[
              "issuer",
              "issuer-remove",
              "book-schema",
              "schema-remove",
            ].includes(operation) && (
              <button
                className="text-button"
                disabled={!identifier || identifier.startsWith("0x")}
                onClick={() => edit(setIdentifier)(hashId(identifier))}
              >
                {tr("입력한 이름을 bytes32 ID로 변환")}
              </button>
            )}
            {[
              "issuer",
              "grant",
              "role-revoke",
              "allow",
              "disallow",
              "indexer",
            ].includes(operation) && (
              <>
                <Field
                  label={tr("대상 주소")}
                  value={target}
                  setValue={edit(setTarget)}
                />
                {operation === "issuer" && (
                  <p className="fine-print">
                    {tr(
                      "이미 있는 ID의 주소 변경은 먼저 등록 해제가 필요할 수 있습니다. 시뮬레이션으로 확인하세요.",
                    )}
                  </p>
                )}
              </>
            )}
            {role === "admin" &&
              ["allow", "disallow", "indexer", "balance-root"].includes(
                operation,
              ) &&
              !book.endsWith("Resolver") && (
                <p className="notice danger">
                  {tr("이 작업은 resolver 계약을 선택하세요.")}
                </p>
              )}
            <button
              className="primary"
              disabled={
                busy ||
                (role === "admin" &&
                  ["allow", "disallow", "indexer", "balance-root"].includes(
                    operation,
                  ) &&
                  !book.endsWith("Resolver"))
              }
              onClick={() =>
                void run(operation === "offchain" ? sign : prepare)
              }
            >
              {tr(
                operation === "offchain"
                  ? "지갑으로 EIP-712 서명"
                  : "실행 내용 확인",
              )}
            </button>
            {schemaStatus && (
              <p className="notice break-code">{schemaStatus}</p>
            )}
            {schemaStatus && operation === "schema" && (
              <button
                className="text-button"
                onClick={() => {
                  setOperation("attest");
                  reset();
                }}
              >
                {tr("이 스키마로 발급")}
              </button>
            )}
          </div>
          <div className="studio-panel">
            <h3>{tr("권한·실행 결과")}</h3>
            {contractRole?.caller === connected && (
              <div className="capability-row">
                <strong>{contractRole.contract}</strong>
                <Badge variant={contractRole.hasRole ? "success" : "neutral"}>
                  {tr(
                    contractRole.hasRole ? "선택 역할 보유" : "선택 역할 없음",
                  )}
                </Badge>
                <span>
                  {tr(
                    contractRole.canManage
                      ? "역할 부여·회수 가능"
                      : "역할 부여·회수 불가",
                  )}
                </span>
                <code>getRoleAdmin: {contractRole.roleAdmin}</code>
                <small>
                  {tr("블록")} {contractRole.block}
                </small>
              </div>
            )}
            {(capabilities?.caller === connected ? capabilities.books : []).map(
              (b) => (
                <div key={b.contract} className="capability-row">
                  <strong>{b.contract}</strong>
                  <span>
                    {tr(
                      b.registrationAdmin ? "등록 관리자" : "등록 관리자 아님",
                    )}
                  </span>
                </div>
              ),
            )}
            {call && (
              <TransactionReview
                key={call.to + call.data + connected + chain}
                call={call}
                address={connected}
                chain={chain}
                onConfirmed={(r) => {
                  if (operation === "schema" && r.uids[0]) setSchema(r.uids[0]);
                  if (operation === "attest" && r.uids[0])
                    setIdentifier(r.uids[0]);
                  setCapabilities(null);
                  setContractRole(null);
                }}
              />
            )}
            {role === "builder" && (
              <>
                <p>
                  {tr(
                    "서명 원문은 오프체인 파일로 보관합니다. 타임스탬프·취소는 UID만 EAS에 등록하며 문서 자체를 공개하지 않습니다.",
                  )}
                </p>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const source = await createOffchainExample();
                      setDocument(JSON.stringify(source, null, 2));
                      setDocumentIssuer(source.attester);
                      setIdentifier(source.uid);
                      setChecked(null);
                      setStatus(null);
                    })
                  }
                >
                  {tr("지갑 없이 서명 예제")}
                </button>
                <Field
                  label={tr("기대 발행자 주소")}
                  value={documentIssuer}
                  setValue={(v) => {
                    setDocumentIssuer(v);
                    setChecked(null);
                    setStatus(null);
                  }}
                />
                <label className="input-label">
                  {tr("서명 문서 JSON")}
                  <textarea
                    className="json-input"
                    value={document}
                    onChange={(e) => {
                      setDocument(e.target.value);
                      setChecked(null);
                      setStatus(null);
                    }}
                  />
                </label>
                <div className="example-actions">
                  <button
                    className="secondary-button"
                    disabled={busy || !document || !documentIssuer}
                    onClick={() =>
                      void run(async () => {
                        const result = inspectOffchain(
                          JSON.parse(document),
                          documentIssuer,
                        );
                        setChecked(result);
                        setIdentifier(result.uid);
                        setStatus(
                          await readOffchainStatus(result.signer, result.uid),
                        );
                      })
                    }
                  >
                    {tr("서명·온체인 상태 확인")}
                  </button>
                  <button
                    className="text-button"
                    disabled={!checked}
                    onClick={() =>
                      downloadJSON(
                        JSON.parse(document),
                        "offchain-attestation.json",
                      )
                    }
                  >
                    {tr("서명 문서 저장")}
                  </button>
                </div>
                {checked && (
                  <>
                    <Badge variant="success">{tr("서명 검증 통과")}</Badge>
                    <p className="fine-print">
                      EAS v{checked.version} · {short(checked.signer)} ·{" "}
                      {tr(checked.expired ? "만료" : "현재 기간")}
                    </p>
                    {status && (
                      <dl className="result-facts">
                        <div>
                          <dt>{tr("타임스탬프")}</dt>
                          <dd>
                            {status.timestamp === "0"
                              ? tr("미등록")
                              : new Date(
                                  Number(status.timestamp) * 1000,
                                ).toLocaleString(getLocale())}
                          </dd>
                        </div>
                        <div>
                          <dt>{tr("오프체인 취소")}</dt>
                          <dd>
                            {tr(
                              status.revokedAt === "0"
                                ? "취소 기록 없음"
                                : "취소됨",
                            )}
                          </dd>
                        </div>
                      </dl>
                    )}
                    <p className="fine-print">
                      {tr(
                        "서명 일치는 발행자의 권한이나 사실의 정확성을 보장하지 않습니다. 오프체인 취소는 해당 서명자의 UID 기록을 확인합니다.",
                      )}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => choose("zk")}
                    >
                      {tr("이 문서로 ZK 증명")}
                    </button>
                  </>
                )}
              </>
            )}
            {!call && role !== "builder" && (
              <p>
                {tr(
                  "작업 내용을 준비하면 실제 함수, 계약 주소와 지갑 실행 버튼이 표시됩니다.",
                )}
              </p>
            )}
            {role === "issuer" && (
              <p className="fine-print">
                {tr(
                  "등록된 발행자가 계약 주소라면 Contract Console에서 그 계약의 발급 함수를 호출하세요. 운영 지갑과 실제 EAS attester가 다를 수 있습니다.",
                )}
              </p>
            )}
          </div>
        </div>
      )}
      {busy && (
        <p className="notice" role="status">
          {tr("처리 중")}
        </p>
      )}
      {error && (
        <p className="notice danger" role="alert">
          {tr(error)}
        </p>
      )}
    </section>
  );
}
export function Field({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <label className="workspace-field">
      <span className="input-label">{tr(label)}</span>
      <input
        className="form-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
    </label>
  );
}
function defaultValues(definition: string) {
  try {
    return JSON.stringify(
      definition.split(",").map((s) => {
        const p = ParamType.from(s.trim());
        return p.type === "bool"
          ? true
          : p.baseType === "array"
            ? []
            : p.type === "address"
              ? ZeroAddress
              : p.type.startsWith("bytes")
                ? p.type === "bytes"
                  ? "0x"
                  : ZeroHash
                : p.type === "string"
                  ? ""
                  : "0";
      }),
    );
  } catch {
    return "[]";
  }
}
function SchemaFields({
  definition,
  values,
  setValues,
}: {
  definition: string;
  values: string;
  setValues: (v: string) => void;
}) {
  let fields: ParamType[] = [],
    parsed: unknown[] = [];
  try {
    fields = definition.split(",").map((s) => ParamType.from(s.trim()));
    parsed = JSON.parse(values);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {}
  return (
    <>
      <div className="schema-field-grid">
        {fields.map((p, i) =>
          p.type === "bool" ? (
            <label key={definition + i} className="workspace-field">
              <span className="input-label">{p.name} (bool)</span>
              <select
                className="form-input"
                value={String(parsed[i] ?? true)}
                onChange={(e) => {
                  const next = fields.map((_, j) => parsed[j] ?? "");
                  next[i] = e.target.value === "true";
                  setValues(JSON.stringify(next));
                }}
              >
                <option>true</option>
                <option>false</option>
              </select>
            </label>
          ) : (
            <Field
              key={definition + i}
              label={`${p.name || "field" + i} (${p.type})`}
              value={
                typeof parsed[i] === "object"
                  ? JSON.stringify(parsed[i])
                  : String(parsed[i] ?? "")
              }
              setValue={(v) => {
                const next = fields.map((_, j) => parsed[j] ?? "");
                try {
                  next[i] =
                    p.type === "bool"
                      ? v === "true"
                      : p.baseType === "array" || p.baseType === "tuple"
                        ? JSON.parse(v)
                        : v;
                  setValues(JSON.stringify(next));
                } catch {
                  setValues(v);
                }
              }}
            />
          ),
        )}
      </div>
      <details className="explain-detail">
        <summary>{tr("필드 값 JSON / ABI 디버그")}</summary>
        <textarea
          className="json-input compact-json"
          value={values}
          onChange={(e) => setValues(e.target.value)}
        />
        <pre className="code-box">
          {(() => {
            try {
              return encodeFields(definition, values);
            } catch {
              return tr("필드 형식과 값을 확인하세요.");
            }
          })()}
        </pre>
      </details>
    </>
  );
}
function Expiry({
  value,
  setValue,
}: {
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div className="workspace-field">
      <span className="input-label">{tr("만료 시각")}</span>
      <div className="pill-buttons">
        {[
          [0, "기한 없음"],
          [3600, "1시간 후"],
          [86400, "1일 후"],
        ].map(([s, t]) => (
          <button
            key={s}
            onClick={() =>
              setValue(
                Number(s)
                  ? String(Math.floor(Date.now() / 1000) + Number(s))
                  : "0",
              )
            }
          >
            {tr(t)}
          </button>
        ))}
      </div>
      <p className="fine-print">
        {value === "0"
          ? tr("기한 없음")
          : new Date(Number(value) * 1000).toLocaleString(getLocale())}
      </p>
    </div>
  );
}
