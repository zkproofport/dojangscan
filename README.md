# Dojang Scan

GIWA Sepolia (chain **91342**)의 실제 Dojang/EAS 레코드를 탐색하는 한국어 웹 앱입니다. 기존 ZKProofport 저장소를 수정하지 않고 이 디렉터리에 독립적으로 작성했습니다.

## 실행

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4317
```

브라우저에서 `http://127.0.0.1:4317`을 엽니다. 조회는 공개 GIWA RPC와 GIWA Blockscout HTTP API를 사용하므로 API 키가 필요하지 않습니다.

## 구현된 기능

- 실제 EAS 로그의 도장 목록, 페이지 추가 조회, 스키마·Dojang·취소/만료 필터.
- 지갑 주소, 도장 UID, 스키마 UID/이름, 트랜잭션 해시 검색.
- 도장 원문, ABI 데이터, 발행자·수신 지갑·만료·취소·참조 UID와 고정 EAS 컨트랙트의 레코드 조회.
- SchemaBook 등록 로그 발견 + `getSchemaUid`/SchemaRegistry 재조회. 이전 스키마 버전도 표시.
- AttesterBook의 현재 발행자 매핑, 등록 변경 이력과 구분한 실명 표시. UPbit Korea 외 주소에는 기관명을 추측하지 않음.
- DojangScroll의 주소 인증과 AttestationIndexer의 기본 key 최신 도장 조회.
- 검증 컨트랙트의 실제 `eth_getCode` 확인.
- ZKProofport SDK로 GIWA PoC 요청, QR/딥링크, 결과 polling, 종료/시간 초과 처리.
- CIP-4 고정 프로필의 체인·verifier·signer root·scope·128개 byte 공개 입력 검사와 읽기 전용 onchain verifier 호출.
- EAS 오프체인 v0/v1/v2 JSON의 브라우저 내 EIP-712 서명/UID/도메인/만료 검사. GIWA EAS의 공개 취소·timestamp만 서버 조회.
- EAS attest/revoke calldata를 읽는 내장 지갑 인사이트.
- JSON 다운로드, 공유 가능한 도장/스키마/지갑 URL, 키보드 `/` 검색, 좁은 화면 대응.

## 경계

- 최근 로그 50개를 페이지 단위로 읽습니다. 통계는 **조회 범위**이며 네트워크 전체 발급량이 아닙니다. EAS 전체 및 Dojang을 구분합니다.
- 관리 컨트랙트의 발견 목록은 최대 최근 300개 로그에서 얻으며 부족하면 경고합니다. 등록 상태와 상태 조회에는 확인 시각/블록을 표시합니다. 메모리 cache는 최대 20초(overview)/60초(catalog)입니다. 공개 RPC의 rate limit과 explorer 가용성에 의존합니다.
- 지갑 요약은 현재 등록 스키마/발행자의 **key=0 최신 기록**입니다. 잔액과 같은 자산·snapshot key, 역사 전체는 이 요약에 포함되지 않습니다. 해당 도장 UID/tx를 직접 검색할 수 있습니다.
- `active`는 레코드의 취소·만료 조건입니다. 사실의 진실성·발행기관의 신뢰·잔액 Merkle 경로 검증을 자동으로 뜻하지 않습니다.
- EAS 레코드의 attester가 현재 등록 발행자 주소와 일치하는지 검사합니다. 발행자 교체 이전 이력은 현재 미등록으로 표시될 수 있습니다.
- 하나은행·한화증권·외국인 등록증·자산관리사 자격은 실제 배포를 확인하지 못했으므로 **미등록/설계 대상**입니다. 미래 스키마는 등록 로그와 실제 ABI를 발견하여 확장합니다.
- 현재 ZKProofport GIWA 앱/CIP-4는 **MockGiwaAttester PoC**입니다. 실제 Dojang record inclusion, freshness, 취소 또는 은행/신분증을 증명하지 않습니다.
- 앱/CIP-4 고정 verifier는 `0xeb9eb5452790cfe549ff83ceb3dbe1c432231492`, 공개 입력 128개입니다. `proofport-app-demo`에는 별도의 192-input/다른 verifier 프로필이 있으므로 혼용하지 않고 거부합니다. 실제 기기/지갑 end-to-end 성공은 본 작업에서 확인하지 않았습니다.
- 오프체인 JSON은 브라우저 메모리에만 두고 서버에 원문/서명을 전송하지 않습니다. UID와 복원된 발행자 주소는 공개 RPC로 조회합니다. 발행자를 지정하지 않은 서명 복원은 신뢰할 발행자를 인증하는 것이 아닙니다. EAS onchain 취소 외의 별도 issuer 취소 정책은 통합 대상입니다.

## ZK 파생 도장 등록 설계

`contracts/src/PrivateAttestationRegistry.sol`은 **미배포 draft**입니다. 실제 오프체인 서명을 검증하는 전용 회로/adapter가 필요하며 기존 CIP-4를 사용할 수 없습니다. 프로필은 처음에 하나도 활성화되지 않습니다.

- canonical statement digest가 registry 주소와 chain ID, profile ID, 수신 지갑, scope, nullifier, 조건 hash, 만료, issuer root, revocation root/epoch를 묶습니다.
- 관리자 승인 adapter만 사용하며, 기존 프로필의 회로·스키마·issuer root·수명 의미는 변경할 수 없습니다. 변경은 새 프로필 ID로 합니다.
- 공개 root의 최신성, 수신자, 유효 기간, 범위별 중복을 검사합니다.
- 결과는 별도 EAS 스키마에 조건 식별자·scope·nullifier·epoch를 담아 발급합니다. 원문·원본 credential UID는 기록하지 않습니다.
- root가 교체되면 기존 파생 도장의 소비 가능 상태를 보수적으로 무효화합니다. 소비자는 EAS 존재 여부 외에 `isReceiptCurrent`를 매번 확인해야 합니다.
- root publisher의 정확성/최신성, adapter/circuit 감사와 holder-binding이 핵심 신뢰 가정입니다. 전용 circuit/adapter는 아직 구현되지 않았으므로 실제 bridge 등록 기능은 활성화하지 않았습니다.

자세한 설계는 [architecture](docs/architecture.md)를 참고하세요.

## GIWA MetaMask Snap

`snaps/dojang-insights`에 GIWA 전용 Snap 소스, manifest와 빌드 결과를 준비했습니다.

```sh
npm run build:snap
```

공식 EAS Snap은 공개 설정에 GIWA가 없으므로 자동으로 설치하지 않습니다. 본 Snap 역시 **빌드된 개발 소스**이며 npm/MetaMask 디렉터리에 발행되거나 실제 지갑에 설치되지 않았습니다. MetaMask Flask에서 별도 로컬 설치·SES 검증과 지갑 통합 시험이 필요합니다. [Snap 개발 안내](snaps/dojang-insights/README.md)

## 검증

```sh
npm run check
npm test
forge test --root contracts
npm run build:snap
# 로컬 서버가 실행 중일 때 실제 GIWA 데이터를 읽는 검증
npm run test:live
```

서명/도메인 변조·wrong-chain·wrong-verifier·scope·root·byte 입력·calldata 정책 8개 테스트와 Solidity 정책 9개 테스트를 작성했습니다. Solidity 테스트의 verifier는 정책을 시험하는 **mock**이며 실제 ZK 회로의 soundness를 시험하지 않습니다. 브라우저 자동화/실제 기기·Snap 설치 시험은 사용 가능한 연결이 없어 미확인입니다. WebMCP 검색 도구는 기능 감지로 등록하며 지원 브라우저에서의 실행 검증은 미확인입니다.

## 주요 출처

- [Dojang 공식 문서](https://docs.giwa.io/giwa-ecosystem/dojang)
- [GIWA Sepolia 네트워크](https://docs.giwa.io/get-started/connect-to-giwa)
- [Dojang 소스, 확인 revision 3a4d507a8081645b8b1501d7ef8709b192e231ee](https://github.com/giwa-io/dojang/tree/3a4d507a8081645b8b1501d7ef8709b192e231ee)
- [EAS SDK offchain 구현](https://github.com/ethereum-attestation-service/eas-sdk/blob/master/src/offchain/offchain.ts)
- [EAS MetaMask Snap](https://github.com/ethereum-attestation-service/eas-metamask-snap)
- [MetaMask transaction insights](https://docs.metamask.io/snaps/features/transaction-insights/)
- 로컬 `CIPs/CIPS/cip-4.md`, `circuits/giwa-attestation/src/main.nr`, GIWA 배포 기록, `proofport-app/src/utils/giwaKyc.ts`, `proofport-app-sdk`.
