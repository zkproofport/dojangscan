# 역할별 사용법

로컬 주소: http://127.0.0.1:4317/ · 네트워크: GIWA Sepolia (91342)

## 조회 사용자

도장에는 **발행자, 수신 지갑, 내용, 만료, 취소**가 있습니다. EAS는 이를 기록하는 공통 계약입니다. Dojang은 GIWA가 관리하는 스키마 목록·발행자 목록·resolver 규칙을 추가합니다. 모든 GIWA EAS 기록이 공식 Dojang인 것은 아닙니다.

`도장 탐색`에서 지갑·UID·tx를 검색하고 카드를 열어 내용과 배지 근거를 확인합니다. 조회에는 지갑이나 가스가 필요 없습니다. 관리자 주소를 알더라도 회사의 법적 신원이나 도장 내용의 진실성까지 자동으로 알 수는 없습니다.

직접 해보기: `작업 → 테스트 발급 시작 → 지갑 연결 → 실행 내용 확인`. `bool completedCourse` 스키마가 이미 있으면 UID를 재사용하고, 없으면 지갑으로 등록합니다. `이 스키마로 발급`에서 내 주소에 `true`를 발급한 뒤 영수증 UID를 열어 봅니다. 취소는 해당 발행 지갑으로 진행합니다. 기존 EAS를 사용하며 새 EAS 계약이 필요 없습니다.

## 발행자

`작업 → 발행자`에서 현재 Dojang 스키마를 선택하거나 일반 EAS Schema UID를 입력하고 `UID에서 형식 불러오기`를 누릅니다. 필드를 입력하고 수신자·만료·refUID·취소 설정을 검토합니다. `실행 내용 확인 → 시뮬레이션 → 지갑으로 실행`으로 실제 계약을 호출합니다. 시뮬레이션이 성공해도 실행 직전 상태가 바뀔 수 있어 전송 전에 다시 eth_call·가스 추정을 수행합니다.

발행자 목록의 주소가 계약이면 운영 지갑으로 EAS를 직접 호출하는 것이 그 계약의 발급이 되지는 않습니다. `Contract Console`에 해당 발행 계약의 ABI를 불러오고 그 계약의 발급 함수를 실행합니다. EAS의 실제 발행자 기준은 레코드의 `attester`입니다. 멀티시그는 제안·실행 등 해당 계약의 ABI 경로를 사용해야 합니다.

## 관리자

`작업 → 관리자`에서 관리 계약과 Role ID를 선택하고 `내 관리 권한 조회`를 누릅니다.

| 작업 | 실제 계약 | 필요한 권한 |
|---|---|---|
| 발행자 등록·해제 | DojangAttesterBook | DEFAULT_ADMIN_ROLE |
| Dojang 스키마 등록·해제 | SchemaBook | DEFAULT_ADMIN_ROLE |
| 발급 허용·해제 / indexer 변경 | 선택한 Dojang resolver | 해당 resolver의 DEFAULT_ADMIN_ROLE |
| 잔액 root Schema UID 변경 | BalanceDojangResolver | 해당 resolver의 DEFAULT_ADMIN_ROLE |
| 역할 부여·회수 | 선택한 Book 또는 resolver | getRoleAdmin(대상 역할)에 해당하는 역할 |

**Book 등록과 resolver 허용은 별도 트랜잭션**입니다. Book 목록에 등록됐다고 resolver가 자동으로 허용하지 않습니다. allowlist에 공개 getter가 없으므로 허용 배지를 추측하지 않고, 실제 발급 시뮬레이션으로 확인합니다. 업그레이드 역할은 등록 관리자와 별개이며 이름으로 계산한 Role ID도 ABI/공식 소스와 비교할 수 있습니다.

알 수 없는 운영 계약은 `Contract Console → 검증된 ABI 불러오기` 또는 직접 ABI 입력을 사용합니다. proxy의 검증된 implementation ABI도 합칩니다. 조회 함수는 RPC로 읽고, 쓰기 함수는 지갑 실행 전에 인자와 calldata를 검토합니다. 배열·tuple은 JSON, bool은 true/false, 정수는 10진 문자열을 사용합니다.

## 오프체인 발행자

`작업 → 오프체인 발행`에서 `uint256 balanceKRW`와 값 `1000000`, 수신 지갑, `1시간 후` 만료를 선택하고 지갑으로 EIP-712 서명합니다. 이 서명은 온체인 발급과 다릅니다. 원문·서명은 JSON 파일로 저장하고 전달합니다. 이 폼은 EAS v2, resolver=0, revocable=true, refUID=0을 사용합니다.

`서명·온체인 상태 확인`은 서명자를 기대 발행자와 비교하고 EAS의 `getTimestamp(uid)`와 `getRevokeOffchain(signer, uid)`를 조회합니다. `오프체인 UID 타임스탬프`와 `오프체인 UID 취소`는 실제 지갑 트랜잭션입니다. 타임스탬프는 누구나 등록할 수 있으며 발행자 진위를 인증하지 않습니다. 원본 서명자의 취소 기록만 그 문서의 취소 판단에 사용합니다. 예제 임시 키는 보관하지 않으므로 예제를 그 키로 나중에 취소할 수 없습니다.

## ZKProofport 개발자

`Proof Studio → 잔액 ZK 증명` 또는 `작업 → ZK 개발`에서 `서명된 100만원 예제 → 실제 ZK proof 생성`을 실행합니다. 50만원 기준은 통과하고, 100만원 초과는 생성에 실패합니다. 생성 후 `기준 금액 변조 테스트`는 회로에 바인딩된 공개 기준을 바꾸므로 검증에 실패합니다.

새 프로필은 CIP-4와 독립적입니다. Noir 1.0.0-beta.8과 Barretenberg 1.0.0-nightly.20250723의 **keccakZK** 모드로 브라우저 Web Worker에서 실제 proof를 생성·검증합니다. 임시 키가 서명한 예제는 은행 도장이 아닙니다. 첫 실행에는 공개 CRS 다운로드가 필요합니다.

회로는 EAS v2의 정식 typed-data digest, secp256k1 서명, 발행자 주소, signed recipient, 잔액 기준, 만료, registry·scope를 포함한 salt 기반 nullifier를 검증합니다. 정확한 잔액·salt·원문·서명·원본 UID는 proof JSON에 없습니다. 공개 issuer·recipient·scope 등은 연계 가능하므로 익명성을 보장하는 프로필로 해석하면 안 됩니다. 지원 금액은 uint128 범위이며 서명된 필드는 ABI uint256입니다.

내보낸 proof JSON은 공개 입력 159개와 proof 16,256 bytes, 회로 해시·VK hash를 포함합니다. 다시 가져와 동일 회로/키로 검증할 수 있습니다. ABI calldata, revert 원인, 생성 시간, 공개 입력을 비교해 회로·verifier·모바일 앱 연동을 디버깅합니다.

온체인 개발 테스트:

```sh
npm run test:zk          # 실제 proof, Solidity verifier 생성, 변조 거부
npm run test:zk:onchain  # 폐기 가능한 로컬 GIWA fork에서 실제 EAS/권한/receipt 테스트
```

두 번째 명령은 Foundry `anvil`·`forge`가 필요합니다. 로컬 18545 포트를 사용하고 종료 시 fork를 폐기합니다. 공개 GIWA RPC는 읽기만 하며 공개 체인에 거래를 보내지 않습니다. fork 내부의 현재 관리자 impersonation은 로컬 함수 테스트에만 쓰며 UI나 실제 네트워크에 관리자 키·권한을 제공하지 않습니다.

`BalanceProofReceipt`를 GIWA Sepolia에 별도로 배포한 경우, 그 주소로 proof를 다시 생성한 뒤 원본 수신 지갑을 연결하고 `온체인 등록 준비 → 지갑으로 실행`할 수 있습니다. EAS·schema·issuer·domain·scope·최소 기준·회로/VK 정책을 먼저 조회·비교합니다. 파생 EAS 기록의 발행자는 receipt 계약입니다. 공식 Dojang 목록에 자동 등록되지 않습니다.

**이 개발용 회로는 원본 취소 여부·은행의 사실 확인·Dojang 발행 허용 목록을 증명하지 않습니다.** Receipt는 이 한계를 `sourceRevocationProven=false`로 기록하고 최대 하루의 원본 유효 기간을 요구합니다. 서비스 접근 권한으로 사용하려면 신뢰 발행자 정책, 인증된 최신 취소 데이터, 갱신 정책과 감사된 회로를 추가해야 합니다. 기존 `PrivateAttestationRegistry` draft의 root/digest adapter 프로필과 이 회로를 혼용하지 않습니다.

모바일 `CIP-4` 탭은 기존 ZKProofport 앱의 MockGiwaAttester 트랜잭션과 대상 지갑 소유 증명 테스트입니다. 임의 EAS 문서나 이 잔액 문서를 그 앱 회로가 자동으로 지원하지는 않습니다.
