# 운영자 사용법 / Operator guide

상단 **발행자·관리자**에서 역할을 선택한 뒤 **목록 / 발급·취소 / 권한·등록 관리**를 전환합니다. Contract Console도 같은 화면에 있습니다.

Open **Issuers & roles**, choose a role, then switch between the directory and actions. Contract Console is in the same area.

## 발행자 / Issuer

1. GIWA Sepolia 지갑을 연결합니다.
2. 등록된 Dojang 스키마를 선택하고 수신 주소·필드·만료 시각을 입력합니다.
3. **권한 확인 후 실행 준비** → 호출 검토 → **지갑으로 실행**.
4. 영수증의 UID로 발급 결과를 확인합니다. 취소는 동일 스키마와 발급 UID를 사용합니다.

발행자가 컨트랙트 주소라면 **Contract Console**에서 그 계약의 발급 함수를 호출하세요. 등록 목록에 있다는 사실만으로 resolver 발급 권한이 생기지는 않습니다.

Connect a GIWA Sepolia wallet, select a registered schema, fill in the recipient and fields, check permissions, then approve the transaction. For contract-based issuers, call the issuer contract through the Console.

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

After receipt, the inspector shows the separately entered lookup address alongside a literal-address check against the actual SDK response and public input bytes. Faucet exposes five public values from 160 byte fields; EAS KYC Mock exposes six from 192, including the pinned signer-list root. Full proof hex, original public inputs, and the unfiltered SDK response JSON are available to inspect and download before verification. The UI does not claim anonymity: the nullifier is computable from candidate addresses and scope. The raw response is retained separately from normalized verifier inputs, including any unexpected fields.

### EAS KYC Mock

Upbit KYC의 테스트넷 활용 한계로 메인넷 적용 전 흐름을 테스트하는 Masse Labs 목업입니다. 계정 주소를 `support@masselabs.com`으로 보내면 관리자가 직접 등록합니다. UI는 이메일 작성 링크만 제공하며 이메일 전송이나 등록 트랜잭션을 실행하지 않습니다.

등록 확인 → 앱 증명 생성 → 데이터 확인 및 검증 순서입니다. `giwa_attestation` 서킷, verifier `0x5da234546874304f8c51bbeed00fc632938211c1`, scope `dojangscan:mock-kyc:v1`를 사용합니다. `MockGiwaAttester`는 `0x6646d970499bbed728636823a5a7e551e811b414`, 허용된 서명자는 `0xEE099845CDfF93e73aDcBcB36A9B93578bcCed4b`입니다. Proof Studio는 192개 공개 입력 중 발급자 root, 요청 action/domain, scope, 계정 nullifier를 모두 검사합니다.

공식 Dojang Book 등록과 별개인 목업이므로 정확한 EAS 발급자·스키마의 수신 이벤트를 조회하고 최신 블록의 EAS 상태를 읽습니다. 최대 10페이지 조회가 끝나지 않으면 미등록으로 단정하지 않습니다. 취소·만료 여부는 별도 RPC 사전 검사이며 ZK 증명 자체가 현재 KYC 상태를 보장하지 않습니다. 실습은 반복 가능하며 실제 Upbit 인증이나 보상 청구가 아닙니다.
