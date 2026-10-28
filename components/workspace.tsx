import { ChainLoading } from "./chain-loading";
import { lazy, Suspense, useEffect, useState, useRef } from "react";
import { ParamType, ZeroAddress, ZeroHash, id as hashId } from "ethers";
import { tr } from "@/lib/i18n";
import { formatDateTime } from "@/lib/date-time";
import { NETWORK, short, type ScanData } from "@/lib/giwa";
import { connectWallet, addGiwa, injected } from "@/lib/wallet";
import { walletState, explainError } from "@/lib/transactions";
import {
  prepareCall,
  inspectCapabilities,
  inspectContractRole,
  readSchema,
  encodeFields,
  requireDojangSchema,
  simulateCall,
  type PreparedCall,
} from "@/lib/workspace";
import { Badge } from "./scan-ui";
import { TransactionHistory } from "./transaction-history";
import { TransactionReview } from "./transaction-review";
import {
  contractIssuerSchema,
  inspectContractIssuer,
  prepareContractIssuerCall,
} from "@/lib/contract-issuer";
const ContractConsole = lazy(() => import("./contract-console"));
const options: Record<string, string[][]> = {
  issuer: [
    ["attest", "도장 발급"],
    ["revoke", "도장 취소"],
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
  role,
}: {
  data: ScanData | null;
  role: "issuer" | "admin" | "console";
}) {
  const [operation, setOperation] = useState(
      role === "admin" ? "issuer" : "attest",
    ),
    [connected, setConnected] = useState(""),
    [chain, setChain] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [definition, setDefinition] = useState(""),
    [values, setValues] = useState("[]"),
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
  const revision = useRef(0);
  const [issuerMode, setIssuerMode] = useState<"wallet" | "contract">("wallet");
  const [issuerContract, setIssuerContract] = useState("");
  const viaContract = role === "issuer" && issuerMode === "contract";
  const contractSchema = contractIssuerSchema(schema);
  const fixedRecipient =
    viaContract && ["root", "code"].includes(contractSchema?.key ?? "");
  const reset = () => {
    revision.current++;
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
      revision.current++;
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
    revision.current++;
    const { signer } = await connectWallet();
    const state = await walletState();
    setConnected(await signer.getAddress());
    setChain(state.chain);
    if (!recipient) setRecipient(state.address);
    setCall(null);
    setCapabilities(null);
    setContractRole(null);
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
    const currentRevision = ++revision.current;
    setCall(null);
    if (!connected || chain !== NETWORK.chainId)
      throw new Error(tr("GIWA Sepolia 지갑을 연결하세요."));
    if (role === "admin") {
      const selectedRole = ["grant", "role-revoke"].includes(operation)
        ? roleId
        : ZeroHash;
      const permission = await inspectContractRole(
        book,
        connected,
        selectedRole,
      );
      if (currentRevision !== revision.current) return;
      setContractRole(permission);
      if (
        ["grant", "role-revoke"].includes(operation)
          ? !permission.canManage
          : !permission.hasRole
      )
        throw new Error(tr("이 작업에 필요한 관리 권한이 없습니다."));
    } else if (!(viaContract && operation === "revoke")) {
      const selectedSchema = data?.schemas.find(
        (s) => s.uid.toLowerCase() === schema.toLowerCase(),
      );
      await requireDojangSchema(schema, selectedSchema?.id);
      const record = await readSchema(schema);
      if (operation === "attest") {
        if (record.definition !== definition)
          throw new Error(tr("등록된 스키마 형식을 다시 불러오세요."));
        if (!record.revocable && (viaContract || revocable))
          throw new Error(tr("취소할 수 없는 스키마입니다."));
        setResolver(record.resolver);
      }
    }
    if (currentRevision !== revision.current) return;
    const prepared = viaContract
      ? prepareContractIssuerCall(operation, {
          ...input(),
          target: issuerContract,
        })
      : prepareCall(operation, input());
    if (viaContract) {
      await inspectContractIssuer(prepared, connected, schema);
      if (currentRevision !== revision.current) return;
    }
    await simulateCall(prepared, connected);
    if (currentRevision !== revision.current) return;
    setSchemaStatus(tr("권한·실행 시뮬레이션 확인 완료"));
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
  return (
    <section className="view-section workspace">
      {busy && (
        <ChainLoading
          title="요청을 처리하고 있습니다."
          description="지갑 요청 또는 온체인 조회를 처리 중입니다. 지갑에 요청이 표시되면 확인하세요."
        />
      )}
      <div className="workspace-wallet">
        <div>
          <Badge variant={connected ? "success" : "neutral"}>
            {tr(connected ? "연결됨" : "지갑 미연결")}
          </Badge>
          <code>
            {connected ? short(connected, 10) : tr("관리할 지갑을 연결하세요.")}
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
      {role === "console" ? (
        <Suspense fallback={<p>{tr("화면 준비 중")}</p>}>
          <ContractConsole address={connected} chain={chain} />
        </Suspense>
      ) : (
        <div className="studio-grid">
          <div className="studio-panel">
            <h3>{tr(role === "admin" ? "Dojang 관리" : "도장 발급·취소")}</h3>
            {role === "issuer" && (
              <>
                <label className="input-label">
                  {tr("발급 방식")}
                  <select
                    className="form-input"
                    value={issuerMode}
                    onChange={(e) => {
                      setIssuerMode(e.target.value as "wallet" | "contract");
                      if (
                        e.target.value === "contract" &&
                        contractSchema?.key === "address"
                      )
                        setValues("[true]");
                      reset();
                    }}
                  >
                    <option value="wallet">{tr("지갑 직접 발급")}</option>
                    <option value="contract">{tr("컨트랙트로 발급")}</option>
                  </select>
                </label>
                {viaContract ? (
                  <>
                    <label className="input-label">
                      {tr("등록 주소에서 선택")}
                      <select
                        className="form-input"
                        value={
                          data?.issuers.some(
                            (i) =>
                              i.address.toLowerCase() ===
                              issuerContract.toLowerCase(),
                          )
                            ? issuerContract.toLowerCase()
                            : ""
                        }
                        onChange={(e) =>
                          edit(setIssuerContract)(e.target.value)
                        }
                      >
                        <option value="">
                          {tr("발행자 컨트랙트를 선택하거나 직접 입력하세요.")}
                        </option>
                        {data?.issuers.map((i) => (
                          <option key={i.id} value={i.address.toLowerCase()}>
                            {tr(i.name)} · {short(i.address, 8)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label="발행자 컨트랙트"
                      value={issuerContract}
                      setValue={edit(setIssuerContract)}
                    />
                    <p className="notice">
                      {tr(
                        "운영 지갑으로 연결하세요. 도장은 선택한 컨트랙트 주소로 발급됩니다.",
                      )}
                    </p>
                    <p className="fine-print">
                      {tr(
                        "MasseDojangAttester 호환 계약의 네 가지 발급과 취소를 지원합니다. 실행 준비 시 계약 함수와 운영 권한을 확인합니다. 다른 계약은 Contract Console을 사용하세요.",
                      )}
                    </p>
                  </>
                ) : (
                  <p className="fine-print">
                    {tr(
                      "연결 지갑이 EAS를 직접 호출합니다. 등록 발행자가 컨트랙트라면 ‘컨트랙트로 발급’을 선택하세요.",
                    )}
                  </p>
                )}
              </>
            )}
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
                {["grant", "role-revoke"].includes(operation) && (
                  <>
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
                            hashId(
                              "dojang." + book.toLowerCase() + ".upgrader",
                            ),
                          );
                          setContractRole(null);
                          reset();
                        }}
                      >
                        UPGRADER_ROLE
                      </button>
                    </div>
                  </>
                )}
                <button
                  className="secondary-button"
                  disabled={busy || !connected}
                  onClick={() =>
                    void run(async () => {
                      setContractRole(
                        await inspectContractRole(
                          book,
                          connected,
                          ["grant", "role-revoke"].includes(operation)
                            ? roleId
                            : ZeroHash,
                        ),
                      );
                      setCapabilities(
                        await inspectCapabilities(
                          connected,
                          "",
                          ["grant", "role-revoke"].includes(operation)
                            ? roleId
                            : ZeroHash,
                        ),
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
            {(operation === "attest" ||
              (operation === "revoke" && !viaContract)) && (
              <>
                <label className="input-label">
                  {tr("현재 Dojang 스키마")}
                  <select
                    className="form-input"
                    value={schema}
                    onChange={(e) => {
                      const record = data?.schemas.find(
                        (s) => s.uid === e.target.value,
                      );
                      if (record) useSchema(record);
                      else {
                        setSchema("");
                        setDefinition("");
                        reset();
                      }
                    }}
                  >
                    <option value="">{tr("도장 종류를 선택하세요.")}</option>
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
            {operation === "attest" && definition && (
              <>
                <p className="fine-print break-code">{definition}</p>
                {viaContract && contractSchema?.key === "address" ? (
                  <p className="notice">
                    {tr("이 컨트랙트는 isVerified=true로 발급합니다.")}
                  </p>
                ) : (
                  <SchemaFields
                    definition={definition}
                    values={values}
                    setValues={edit(setValues)}
                  />
                )}
              </>
            )}
            {["attest", "revoke", "book-schema", "balance-root"].includes(
              operation,
            ) &&
              !(viaContract && operation === "revoke") && (
                <details
                  className="explain-detail"
                  open={role === "admin" ? true : undefined}
                >
                  <summary>{tr("스키마 UID 직접 입력")}</summary>
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
                </details>
              )}
            {operation === "attest" && (
              <>
                {fixedRecipient ? (
                  <p className="fine-print">
                    {tr(
                      "이 도장은 개별 수신 지갑 없이 발급됩니다 (recipient = 0x0).",
                    )}
                  </p>
                ) : (
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
                  </>
                )}
                {viaContract && contractSchema?.key === "balance" && (
                  <>
                    <Field
                      label="Balance Root Attestation UID"
                      value={refUID}
                      setValue={edit(setRefUID)}
                    />
                    <p className="fine-print">
                      {tr(
                        "같은 컨트랙트가 발급한 유효한 Balance Root의 UID와 해당 잔액의 Merkle proof가 필요합니다.",
                      )}
                    </p>
                  </>
                )}
                {viaContract && contractSchema?.key === "root" && (
                  <p className="fine-print">
                    {tr(
                      "coinType은 BIP44 번호가 아닌 Dojang 티커 인코딩입니다. Contract Console의 coinTypeFromTicker로 조회할 수 있습니다.",
                    )}
                  </p>
                )}
                {viaContract && contractSchema?.key === "code" && (
                  <p className="fine-print">
                    {tr(
                      "codeHash에는 코드의 keccak256 해시를 입력하세요. 도메인은 계약에서 ASCII 공백 제거와 소문자 변환을 적용합니다.",
                    )}
                  </p>
                )}
                <Expiry value={expiration} setValue={edit(setExpiration)} />
                {viaContract ? (
                  <p className="fine-print">
                    {tr("이 컨트랙트가 발급한 도장은 취소할 수 있습니다.")}
                  </p>
                ) : (
                  <details className="explain-detail">
                    <summary>{tr("추가 설정")}</summary>
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
                  </details>
                )}
                <p className="notice">
                  {tr(
                    "온체인 발급 내용은 공개됩니다. 개인정보나 원본 증명서를 입력하지 마세요.",
                  )}
                </p>
              </>
            )}
            {[
              "issuer",
              "issuer-remove",
              "book-schema",
              "schema-remove",
              "revoke",
            ].includes(operation) && (
              <Field
                label={tr(
                  operation === "revoke"
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
                !connected ||
                chain !== NETWORK.chainId ||
                (viaContract && !issuerContract) ||
                (role === "admin" &&
                  ["allow", "disallow", "indexer", "balance-root"].includes(
                    operation,
                  ) &&
                  !book.endsWith("Resolver"))
              }
              onClick={() => void run(prepare)}
            >
              {tr("권한 확인 후 실행 준비")}
            </button>
            {schemaStatus && (
              <p className="notice break-code">{schemaStatus}</p>
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
                  if (operation === "attest" && r.uids[0])
                    setIdentifier(r.uids[0]);
                  setCapabilities(null);
                  setContractRole(null);
                }}
              />
            )}
            {!call && (
              <p>
                {tr(
                  "작업 내용을 준비하면 실제 함수, 계약 주소와 지갑 실행 버튼이 표시됩니다.",
                )}
              </p>
            )}
            {role === "issuer" && (
              <p className="fine-print">
                {tr(
                  "지갑 직접 발급은 연결 지갑이, 컨트랙트 발급은 선택한 계약이 EAS 발행자로 기록됩니다. 전송 전에 대상 계약과 함수를 확인하세요.",
                )}
              </p>
            )}
          </div>
        </div>
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
        {value === "0" ? tr("기한 없음") : formatDateTime(Number(value))}
      </p>
    </div>
  );
}
