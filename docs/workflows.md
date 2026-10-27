# 운영자 사용법 / Operator guide

상단 **발행자·관리자**에서 역할을 선택한 뒤 **목록 / 발급·취소 / 권한·등록 관리**를 전환합니다. Contract Console도 같은 화면에 있습니다.

Open **Issuers & roles**, choose a role, then switch between the directory and actions. Contract Console is in the same area.

## 발행자 / Issuer

1. GIWA Sepolia 지갑을 연결합니다.
2. **발급 방식**에서 **지갑 직접 발급** 또는 **컨트랙트로 발급**을 선택합니다. 컨트랙트 방식은 등록 주소에서 발행자 계약을 선택하거나 직접 입력합니다.
3. 등록된 Dojang 스키마를 선택하고 수신 주소·필드·만료 시각을 입력합니다.
4. **권한 확인 후 실행 준비** → 호출 검토 → **지갑으로 실행**.
5. 영수증의 UID로 발급 결과를 확인합니다. 컨트랙트 취소는 발급한 계약과 발급 UID를 선택합니다. 지갑 직접 취소는 동일 스키마와 발급 UID를 사용합니다.

컨트랙트 방식은 `MasseDojangAttester` 호환 ABI의 Verified Address, Balance Root, Verified Balance, Verified Code 및 `revokeAttestation`을 지원합니다. 검증된 ABI, 운영 지갑의 `operators` 권한, 발급 일시정지 여부, 스키마 UID를 확인한 뒤 연결 지갑에서 계약을 호출하는 경로를 시뮬레이션합니다. 도장의 EAS 발행자는 해당 계약입니다. 다른 인터페이스의 계약은 **Contract Console**을 사용하세요. 등록 목록에 있다는 사실만으로 resolver 발급 권한이 생기지는 않습니다.

주소 인증은 `isVerified=true`, Root·Code는 수신 주소 `0x0`, 모든 발급은 취소 가능으로 고정됩니다. 잔액 인증에는 같은 계약이 발급한 유효한 Balance Root UID와 잔액 Merkle proof가 필요합니다. Root의 `coinType`은 BIP44 번호가 아닌 Dojang 티커 인코딩이며 계약의 `coinTypeFromTicker`로 조회할 수 있습니다. Code에는 원문이 아닌 코드 해시를 입력합니다.

Connect a GIWA Sepolia wallet and choose **Issue directly from wallet** or **Issue through contract**. For a contract issuer, select a registered address or enter the contract address. The guided form supports MasseDojangAttester-compatible contracts and checks the verified ABI, operator permission, pause state and schema before simulating the call from the connected wallet. The contract becomes the EAS attester. Other interfaces remain available through the Console. Review the target and function before approving. Contract revocation takes the issuing contract and attestation UID; direct wallet revocation also requires the schema.

Verified Address always asserts true. Root and Code use a zero recipient. All contract-issued attestations are revocable. Verified Balance requires an active root issued by the same contract and a matching Merkle proof. Use Dojang ticker encoding for Root coinType (the contract's `coinTypeFromTicker` helper), and a code hash for Verified Code.

## 관리자 / Administrator

| 작업 / Operation | 권한 / Permission |
|---|---|
| 발행자 등록·해제 / Issuer registration | DojangAttesterBook `DEFAULT_ADMIN_ROLE` |
| 스키마 등록·해제 / Schema registration | SchemaBook `DEFAULT_ADMIN_ROLE` |
| Resolver 허용·설정 / Resolver configuration | 해당 resolver / target resolver `DEFAULT_ADMIN_ROLE` |
| 역할 부여·회수 / Grant or revoke role | `getRoleAdmin(targetRole)` |

**내 관리 권한 조회**로 현재 지갑의 역할을 확인합니다. 스키마 등록은 기존 EAS Schema UID를 Dojang 목록에 등록하는 작업입니다. 새로운 EAS 스키마 생성 등 추가 함수는 Console에서 실행할 수 있습니다.

Use **Check my management roles** to inspect the connected wallet. Schema registration adds an existing EAS schema UID to the Dojang Book. Additional functions, including EAS schema creation, are available through the Console.

## Contract Console

실제 컨트랙트를 선택하고 **검증된 ABI 불러오기**를 누릅니다. 조회 함수는 읽기 전용입니다. 변경 함수는 시뮬레이션과 지갑 승인을 거쳐 실제 트랜잭션을 보냅니다. 권한은 대상 계약이 검사합니다.

Select a real contract and load its verified ABI. Read functions do not send transactions. Write functions require simulation and wallet approval, and the target contract enforces permissions.

## Proof Studio

1. GIWA Playground에서 Faucet으로 테스트 도장을 발급받습니다.
2. Dojangscan 가이드 또는 내 도장에서 같은 지갑 주소를 조회하고 **Proof Studio에서 ZK 실습하기**로 이동합니다. Studio에서 바로 조회해도 됩니다.
3. ZKProofport 앱을 설치하고 발급에 사용한 같은 지갑을 연결합니다.
4. **ZK 증명 요청하기** → QR 스캔(모바일에서는 앱 열기) → 앱에서 생성 → 웹에서 **증명 검증하기** 순으로 진행합니다. 검증은 GIWA Sepolia verifier의 읽기 전용 호출이므로 웹 지갑 연결이나 가스가 필요 없습니다.

앱 결과 수신과 암호학적 검증 성공을 구분합니다. 요청 취소·시간 초과·오류 후 다시 시작할 수 있습니다. 취소되거나 만료된 도장은 조회 단계에서 표시하고 요청을 막지만, ZK 자체가 현재 도장의 유효성을 증명하지는 않습니다. 같은 지갑으로 실습을 반복할 수 있으며 보상 청구나 중복 사용 방지 기능은 없습니다.

Issue through Playground, check the same wallet, install the ZKProofport app, request and generate a proof, then explicitly verify it. This is testnet signature-proof practice, before using mainnet attestations. The page knows the scanned address. A current attestation check and cryptographic proof verification are separate observations.

### 연결 요건 / Connection requirements

- SDK `@zkproofport-app/sdk` is pinned to `0.4.2`. Relay: `https://relay.zkproofport.app`. Circuit: `dojang_playground`. Chain: `91342`. Verifier: `0x2d01c2fe3445b7dde60118f956bb14e84fd64724`.
- The relay must allow the web origin, including `https://dojangscan.com` (and the development origin for local end-to-end tests). On 2026-10-15, production relay responses did not allow the Dojangscan origin. This change does **not** modify or deploy the relay; QR creation/result retrieval remain blocked until its allowlist is updated separately.
- Publish the site only after the official app-store release includes Playground without the Developer Mode gesture. The UI assumes that release; until then, review locally.
- No site or app deployment is included in this preparation. End-to-end mobile generation and successful live proof verification still need validation with a supported app and an allowed relay origin.

### 수신 데이터 / Received data

Proof types are listed separately from their practice workflows. Faucet and EAS KYC Mock are supported, with independent sessions and circuit-specific validation.

After receipt, the inspector shows the request ID and a link to the pinned circuit-specific verifier contract, followed by collapsed sections for the full proof hex, original public inputs, and unfiltered SDK response JSON, plus a JSON download button. Address comparisons and decoded public value cards are omitted. Circuit-specific public input validation and contract verification remain part of the proof flow.

### EAS KYC Mock

Upbit KYC의 테스트넷 활용 한계로 메인넷 적용 전 흐름을 테스트하는 Masse Labs 목업입니다. 계정 주소를 `support@masselabs.com`으로 보내면 관리자가 직접 등록합니다. UI는 이메일 작성 링크만 제공하며 이메일 전송이나 등록 트랜잭션을 실행하지 않습니다.

등록 확인 → 앱 증명 생성 → 데이터 확인 및 검증 순서입니다. `giwa_attestation` 서킷, verifier `0x5da234546874304f8c51bbeed00fc632938211c1`, scope `dojangscan:mock-kyc:v1`를 사용합니다. `MockGiwaAttester`는 `0x6646d970499bbed728636823a5a7e551e811b414`, 허용된 서명자는 `0xEE099845CDfF93e73aDcBcB36A9B93578bcCed4b`입니다. Proof Studio는 192개 공개 입력 중 발급자 root, 요청 action/domain, scope, 계정 nullifier를 모두 검사합니다.

공식 Dojang Book 등록과 별개인 목업이므로 정확한 EAS 발급자·스키마의 수신 이벤트를 조회하고 최신 블록의 EAS 상태를 읽습니다. 최대 10페이지 조회가 끝나지 않으면 미등록으로 단정하지 않습니다. 취소·만료 여부는 별도 RPC 사전 검사이며 ZK 증명 자체가 현재 KYC 상태를 보장하지 않습니다. 실습은 반복 가능하며 실제 Upbit 인증이나 보상 청구가 아닙니다.
## Browse by use case / 사용처별 조회

새 기능은 메뉴 옆 **N** 배지로 표시합니다. **사용처별 조회** 메뉴를 열면 데이터를 요청하지 않고 검색창과 **찾기** 버튼만 표시합니다. 사용처를 입력하고 **찾기** 또는 Enter를 눌러야 조회합니다. 공유 링크는 조건만 미리 채우며 자동 조회하지 않습니다. 입력 중에는 기존 조회 조건과 결과가 바뀌지 않습니다. 조회 후에는 불러온 기록의 사용처를 선택하거나 **상세 조건**에서 발행자·상태·기간을 좁힐 수 있습니다. 도장 탐색의 일반 검색창에서 사용처 검색을 실행하면 이 화면으로 이동해 바로 조회합니다. 도장 종류 이름과 일치하는 검색은 기존처럼 해당 종류를 엽니다.

- 검색창의 `doctorloan`은 입력 예시인 플레이스홀더입니다. 기본 검색값이나 고정 사용처 목록이 아니며 기관·업무를 의미하는 별도 매핑도 없습니다.
- 검색은 대소문자와 Unicode 정규화를 적용한 부분 일치입니다. 사용처를 선택하면 원래 온체인 문자열로 정확히 필터링합니다. 다른 언어 표기나 기관 이름을 임의로 연결하지 않습니다. 검색 결과가 없으면 실제 불러온 기록의 사용처를 별도로 제시합니다.
- 사용처는 EAS 데이터의 `domain`, 발행 주소는 EAS `attester`, 등록 정보는 AttesterBook에서 가져옵니다. 사용처 이름으로 기관이나 업무 내용을 추정하지 않습니다. 발행자 표시명 일부는 출처가 명시된 공식 ID 메타데이터(`lib/issuer-metadata.ts`)이며 온체인 값이 아닙니다.
- 같은 사용처를 여러 발행자가 쓸 수 있으므로 목록에 발행 주소를 함께 표시합니다. 도장 카드·상세의 사용처 링크는 사용처와 발행 주소를 함께 선택합니다.
- **조회 링크 복사**는 검색어·선택 조건을 보존합니다. **조회 결과 CSV 저장**은 불러온 범위 중 일치하는 기록과 원본 주소·해시·UID·시각·기준 블록·조회 범위를 내보냅니다. 전체 네트워크 발급량이 아닙니다.
- 검색 실행 시 현재 Verified Code 스키마의 최근 한 페이지(탐색기 기준 보통 50개)를 가져와 사용처를 필터링합니다. 전체 이력 검색이 아니므로 최근 페이지에 없는 기록은 **이전 코드 인증 기록 더 보기**로 범위를 넓혀야 합니다. 페이지를 추가로 불러와도 같은 블록을 기준으로 EAS 상태를 확인합니다. **조회 범위와 기준 시점**에 자세한 설명을 둡니다. 새로고침하면 새 기준 블록으로 조회합니다. 탐색기 반영은 지연될 수 있습니다.
- **코드 해시로 유효성 확인**은 기본적으로 접혀 있습니다. 기록의 **인증 확인**을 누르면 펼쳐지고 사용처·발행자·해시가 채워집니다. 실행 시 발행자 ID의 현재 주소를 확인하고 새 블록에서 `DojangScroll.isVerifiedCode`, 유효하면 `getVerifyCodeAttestationUid`를 읽습니다. 지갑 연결이나 서명이 필요 없습니다. 원본 인증번호 대신 해시를 사용하며 이 확인 도구의 입력값은 공유 링크에 포함하지 않습니다.
- 기록의 활성 상태와 현재 Scroll 조회의 유효성은 구분합니다. 온체인 인증은 외부 서비스의 처리 상태나 코드 사용 여부를 보장하지 않습니다. 0 수신 주소에는 실제 주소와 **개별 수신 지갑 없음**을 함께 표시합니다.
- 하단 **문제 제보·기능 제안**에서 GitHub 이슈 양식으로 이동합니다.

The **N** badge marks the new feature. Opening **Browse by use case** or a shared link performs no history fetch. Enter a use case and press **Find** or Enter to load records; shared links only prefill the controls. Editing the input does not change the applied query or existing results until submission. Issuer, status and dates live under **More filters** after loading. A submitted main search opens this view and starts the lookup unless it matches a schema name.

The `doctorloan` placeholder is an input example only, not a default filter, fixed use-case list or institutional mapping. Search supports case-insensitive, Unicode-normalized partial matches. Selecting a use case applies its exact original domain. There are no invented language aliases or institutional mappings. Suggestions on an empty search result are actual use cases from loaded records, not claimed matches. Issuer addresses stay visible because multiple issuers may use the same domain.

Shared links preserve the search and filters. CSV exports only matching loaded records, including snapshot and coverage. On submission, history fetches the latest explorer page (normally 50 records) for the current Verified Code schema and filters it locally, using a fixed block across pagination. This is not a full-history domain search. Earlier records can be loaded on request. The optional code-hash verifier is collapsed until needed; a row action opens and prefills it. Verification is read-only and says nothing about an external business process. **Report an issue or suggest a feature** opens GitHub issue forms.
