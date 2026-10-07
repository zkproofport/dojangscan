# Dojang Scan

GIWA Sepolia의 EAS와 Dojang을 쉽게 읽는 **로컬 개발용 정적 웹앱**입니다. 원래 ZKProofport 저장소는 수정하지 않았습니다. 외부 배포 도구·서버 런타임·지갑 확장 설치 코드는 없습니다.

```sh
npm ci
npm run dev
```

주소: **http://127.0.0.1:4317/**

```sh
npm run check
npm test
npm run build
npm run test:live  # 개발 서버가 켜져 있을 때 실제 공개 체인 조회
forge test --root contracts  # 파생 도장 등록 draft의 정책 테스트
```

## 역할별 작업과 화면 설정

상단에서 **한국어 / English**, **라이트 / 다크**를 선택합니다. 선택은 이 브라우저에 저장됩니다. 테마를 처음 선택하기 전에는 시스템 설정을 따릅니다.

**작업 / Workspace**에는 다음 흐름이 있습니다.

| 사용자 | 할 수 있는 일 |
|---|---|
| 조회 사용자 | 최근 도장·스키마·발행자·서명 검증으로 바로 이동 |
| 발행자 | 실제 EAS 발급·취소 calldata 준비, 지정 EOA의 eth_call 시뮬레이션 |
| 관리자 | 두 Book의 등록 권한과 선택 역할의 `getRoleAdmin` / `hasRole` 확인, 발행자·스키마 등록 및 역할 부여 호출 준비 |
| 도장 생성자 | 이름 있는 ABI 필드와 JSON 값으로 일반 스키마/발급 호출 준비, 연결한 지갑으로 EIP-712 오프체인 문서 서명·JSON 저장 |
| ZKProofport 개발자 | 서명된 잔액 예제에 기준 금액 적용, 원문·정확한 잔액·서명·원본 UID를 제외한 증명 프로필 설계 JSON 저장 |

온체인 작업은 **준비·시뮬레이션까지만** 수행합니다. 거래 전송 버튼은 없습니다. 오프체인 지갑 서명은 사용자가 버튼을 누른 경우에만 요청합니다. 가상의 예제에는 임시 키를 사용합니다.

등록된 발행 계약과 이를 실행하는 운영 지갑은 다를 수 있습니다. 계약 주소를 `from`으로 흉내 내는 시뮬레이션을 실제 지갑 권한으로 오해하지 않도록 계약 주소의 시뮬레이션은 거절합니다. 준비한 calldata는 해당 계약·멀티시그 실행 경로에서 사용할 수 있습니다.

잔액 조건 결과는 **브라우저의 일반 계산**입니다. EAS ZK Playbook의 offchain → proof → onchain 패턴을 위한 설계 입력이며, ZK proof나 발급 완료 결과가 아닙니다. 전용 회로·adapter는 구현해야 하며 등록 계약 draft는 미배포 상태입니다. [공식 EAS 패턴](https://docs.attest.org/docs/zk--playbook/best-practices)

## EAS와 Dojang의 관계

- **EAS**: 스키마 등록, 도장 발급·취소, 서명된 오프체인 문서를 위한 공용 계약/형식입니다.
- **Dojang**: GIWA의 EAS 위에 SchemaBook, DojangAttesterBook, resolver의 발급 규칙, 조회 인덱스를 구성한 서비스입니다.
- **Dojang Scan**: 기존 기록 조회와 권한 확인, 호출 준비, 오프체인 서명과 ZK 조건 설계를 제공하는 도구입니다.

GIWA에서 발급된 모든 EAS 기록이 Dojang은 아닙니다. 이 화면의 ‘Dojang 스키마’는 현재/과거 공식 SchemaBook에서 발견한 스키마 UID입니다. 현재 버전과 이전 버전을 구분합니다. 발행자 등록은 스키마 분류와 별개입니다.

## 발행자·관리자·배지 기준

| 화면 표시 | 조회 근거 | 뜻하지 않는 것 |
|---|---|---|
| Dojang 등록 | 공식 DojangAttesterBook의 `getAttester(id)`가 EAS `attester`와 일치 | GIWA 회사 직접 발급, 실제 금융기관 인가 |
| 관리 권한 / 관리 주소 발급 | 공식 SchemaBook 또는 DojangAttesterBook의 현재 `hasRole(DEFAULT_ADMIN_ROLE, address)` | 자동으로 등록된 발행자라는 의미 |
| 업그레이드 | 해당 Book의 현재 `hasRole(UPGRADER_ROLE, address)` | 발급/등록 관리 권한 |
| 일반 EAS 발행자 | 완전하게 발견한 현재 목록에 주소가 없음 | 사기 또는 무효라는 의미 |
| 등록 여부 미확인 | 목록 발견/현재 매핑 조회가 불완전 | 미등록 판정 |
| ZKProofport 테스트 | 로컬 CIP-4에 명시된 MockGiwaAttester 주소 | 실제 고객확인·잔액·신분증 |
| 활성 / 취소 / 만료 | EAS 레코드의 revocationTime/expirationTime | 내용의 진실성·기관의 신뢰 |

두 Book은 OpenZeppelin AccessControl 기반이며 `owner()`나 관리자 전체 목록 getter가 없습니다. `RoleGranted / RoleRevoked`에서 후보를 발견한 뒤 `hasRole`로 재확인합니다. 등록 발행자 주소도 관리자 역할을 직접 조회합니다. **업그레이드 권한은 별도로 표시**합니다.

‘GIWA 직접 발급’이라는 회사 정체성은 계약 역할 하나로 판정할 수 없어 자동 배지를 만들지 않습니다. 발행자 계약과 그 계약에 트랜잭션을 보낸 서명자도 서로 다를 수 있습니다. EAS 기록의 발행자 기준은 `attester`입니다. UPbit Korea 이름은 공식 문서·공식 ID로 확인한 경우에만 붙입니다. 나머지는 기관명을 추측하지 않습니다.

발급 규칙은 SchemaRegistry의 resolver 주소를 봅니다. 공식 Dojang resolver의 allowlist는 공개 getter가 없으므로 현재 허용 여부를 임의로 주장하지 않습니다. 역할과 발행자 등록은 동일 조회 블록에서 확인합니다.

## 화면과 실험

- 도장 카드를 기본으로 종류·내용·발행자 배지를 읽습니다. 표 보기도 선택할 수 있습니다.
- 종류별 탐색, 발행자 필터, 이전 로그 추가 조회, 지갑·UID·tx 검색, 공유 URL과 JSON 저장을 지원합니다.
- ‘처음이라면’에서 도장 한 장의 의미, EAS 관계, 관리 권한과 발행자 차이를 단계별로 설명합니다.
- Proof Studio의 ‘예제 불러오기’는 임시 키로 가상 100만원 잔액 문서에 실제 EIP-712 서명을 만듭니다. 키는 저장/내보내지 않습니다. 예제는 은행 문서나 온체인 발급 도장이 아닙니다. 서명 확인 후 내용을 1원 바꿔 실패를 체험할 수 있습니다.
- 모바일 GIWA 테스트 요청은 SDK relay로 전달되므로 사용자가 요청 버튼을 누른 경우에만 생성합니다. SDK 0.3.1의 GIWA 요청 자체에는 브라우저 지갑 서명이 필요하지 않습니다. 증명용 지갑 서명은 앱에서 진행합니다.
- 받은 proof는 고정 verifier·체인·signer root·128개 공개 byte 입력·scope를 검사한 뒤 **브라우저의 읽기 전용 eth_call**로 검증합니다.
- ‘발급 실험 안내’는 기존 SchemaRegistry/EAS를 사용하는 사용자 테스트 스키마와 발급 calldata를 생성합니다. **실제 등록·발급·취소 트랜잭션을 전송하지 않습니다.**

## 현재 앱이 증명하는 것

CIP-4는 허용된 테스트 서명자가 서명한 EIP-1559 트랜잭션이 고정 MockGiwaAttester의 `attestAccount(address)`를 호출하고, 증명자가 그 대상 주소를 소유한다는 사실을 증명합니다. 대상 주소와 원본 트랜잭션은 회로의 private input입니다. scope·signer root·signal·nullifier는 public input이며 연계 가능성은 별도 고려해야 합니다.

실제 Dojang 고객확인, EAS record inclusion, 최종성, 현재 만료·취소·freshness 또는 은행 잔액·신분 자격을 증명하지 않습니다. 앱 Developer Mode와 기존 mock 테스트 발급 이력이 필요하며 SDK 지원 상태는 `planned`입니다. 자신의 임의 EAS 스키마를 이 회로로 증명할 수는 없습니다. 실제 모바일/relay 완료는 별도 기기 검증 대상입니다.

고정 verifier: `0xeb9eb5452790cfe549ff83ceb3dbe1c432231492`, chain 91342, 공개 입력 128개. 다른 192-input GIWA demo 프로필과 혼용하지 않습니다.

## 기존 EAS로 직접 실험할 수 있나요?

가능합니다. EAS 본체를 새로 배포할 필요 없이 기존 SchemaRegistry에 자신의 테스트 스키마를 등록하고 기존 EAS에 발급·취소하면 됩니다. 처음에는 resolver=0, revocable=true인 `bool completedCourse` 같은 공개 테스트 데이터를 권합니다. 실제 호출에는 테스트 ETH와 지갑 서명이 필요합니다.

공식 Dojang 스키마는 resolver의 발행자 allowlist에 따라 제한됩니다. 자신의 테스트 도장이 공식 SchemaBook/AttesterBook에 자동 등록되지는 않습니다. 별도 발급 제한, ZK 파생 도장 등록 또는 독립 프로토콜이 필요할 때 resolver/등록 계약을 추가합니다.

## GitHub Pages와 로컬 구조

Vite + React로 빌드한 `dist/`는 HTML·CSS·JS만 담습니다. 브라우저에서 공개 GIWA RPC와 explorer API를 직접 읽으며 자체 API 서버, API 키, DB가 필요 없습니다. `base: './'`와 경로를 유지하는 query URL을 사용하여 향후 GitHub Pages 프로젝트 하위 경로에도 대응합니다.

**GitHub Actions·외부 호스팅·배포 설정은 추가하지 않았습니다.** 나중에 Pages를 사용할 때 `dist/`를 배포하면 됩니다. 공개 서비스의 CORS·rate limit·API 가용성이 유지되어야 합니다.

## 조회 범위와 한계

최근 EAS 로그 50개씩 조회합니다. 통계는 현재 불러온 범위이며 전체 발급량이 아닙니다. Book별 최대 최근 300개 로그에서 등록 ID와 역할 후보를 발견합니다. 발견 이력 cache는 최대 10분, catalog 60초, overview 20초이며 확인 블록/시각을 표시합니다. 최신 역할 판정은 해당 catalog의 고정 블록에서 이루어집니다. RPC 호출은 3개 이하 묶음, 요청 사이 최소 650ms, 429 시 최대 세 번 재시도로 제한합니다. 여러 브라우저 탭의 한도는 합쳐질 수 있습니다.

지갑 요약은 현재 등록 스키마/발행자의 key=0 최신 기록입니다. 잔액 자산·snapshot key 및 역사 전체를 포함하지 않습니다. 도장 UID/tx를 직접 검색할 수 있습니다. 발행자 변경 이전 이력은 현재 목록과 일치하지 않을 수 있습니다.

하나은행·한화증권·외국인 등록·전문 자격은 확인된 현재 배포 데이터가 아닌 **설계 대상**입니다. 실제 잔액 금액을 숨기려면 별도의 ZK 회로가 필요합니다. 일반 EAS 기록은 내용이 공개됩니다.

## 미래 ZK 파생 도장

`contracts/src/PrivateAttestationRegistry.sol`은 미배포 draft입니다. 오프체인 발행자 서명·holder-binding·조건·취소를 검증하는 전용 회로/adapter가 아직 없고 활성 프로필도 없습니다. 기존 CIP-4를 여기에 연결할 수 없습니다. [설계 문서](docs/architecture.md)

## 근거

- [Dojang 공식 문서](https://docs.giwa.io/giwa-ecosystem/dojang)
- [DojangAttesterBook](https://github.com/giwa-io/dojang/blob/main/src/DojangAttesterBook.sol), [SchemaBook](https://github.com/giwa-io/dojang/blob/main/src/SchemaBook.sol)
- [AllowlistResolver](https://github.com/giwa-io/dojang/blob/main/src/abstract/AllowlistResolverUpgradeable.sol)
- [EAS SDK offchain](https://github.com/ethereum-attestation-service/eas-sdk/blob/master/src/offchain/offchain.ts)
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- 로컬 `CIPs/CIPS/cip-4.md`, `circuits/giwa-attestation/src/main.nr`, `proofport-app/src/utils/giwaKyc.ts`, `proofport-app/src/screens/proof/ProofGenerationScreen.tsx`, SDK 0.3.1.
