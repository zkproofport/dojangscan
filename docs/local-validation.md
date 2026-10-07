# 로컬 검증 기록

검증일: 2026-10-07 (Asia/Seoul). 외부 웹사이트 배포 및 공개 체인 거래 전송은 수행하지 않았습니다.

## 실행 결과

- TypeScript 검사와 Vite 정적 빌드 통과.
- Node 테스트 22개 통과: EAS v0/v1/v2 서명·UID·domain, 변경된 원문, 신뢰 분류, wallet 계정·체인 변경과 전송 차단, Console bool/배열/ETH 인자·Blockscout proxy ABI·확정 후 오래된 조회 cache 무효화, 새 잔액 회로 입력 바인딩, i18n.
- 기존 `PrivateAttestationRegistry` Solidity 정책 테스트 9개 통과. 이 draft는 새 balance receipt 프로필과 별개입니다.
- Noir **1.0.0-beta.8**로 회로 컴파일 재현 성공. 브라우저용 산출물과 bb.js **1.0.0-nightly.20250723**을 고정했습니다.
- 실제 EIP-712 잔액 서명으로 **keccakZK** proof 생성·검증 성공: 공개 입력 **159개**, proof **16,256 bytes**. Node 생성·검증 약 **17.6초**, 브라우저 약 **19.4초**. 기기·공개 CRS 다운로드에 따라 달라집니다.
- proof 공개 기준 금액 변경 후 암호학적 검증 실패 확인.

## 실제 계약을 사용한 로컬 GIWA fork

`npm run test:zk:onchain`은 공개 GIWA RPC를 읽어 Anvil의 폐기 가능한 복제본을 만듭니다. 거래는 **로컬 fork에만** 전송했습니다. 관리자 impersonation은 이 테스트 안에서만 사용하며 공개 체인의 관리자 권한이나 키를 얻는 기능이 아닙니다.

앱의 EIP-1193 지갑 전송 함수로 다음을 확인했습니다.

- 기존 실제 SchemaRegistry에 새 테스트 스키마 등록 → 기존 EAS 발급 → 취소, 영수증 UID 디코딩.
- EAS offchain timestamp/revokeOffchain 실행.
- 일반 지갑의 Book 관리자 함수 거부.
- 현재 관리자의 Book 발행자 등록·해제, role grant/revoke와 hasRole 결과.
- 실제 AddressDojangResolver allow/remove 실행, 허용 후 실제 Dojang 스키마 발급 성공, 제거 후 거부.
- 실제 Solidity ZK verifier 배포·라이브러리 링크·proof 검증 및 `BalanceProofReceipt` 등록 → 기존 EAS의 파생 레코드 확인.
- 변경된 기준 금액·다른 recipient·registry·domain·중복 nullifier·만료 거부.

최종 파생 발급 블록: **38,034,675 (로컬 fork)**. UID `0x81dce237b7e16fd15166b8ff9241e644a0f809bd8e6fdeb2deb70609d0822fcf`는 로컬 검증 결과이며 공개 GIWA explorer에 있는 기록이 아닙니다. fork는 테스트 종료 후 폐기했습니다.

## 브라우저

격리된 headless Chrome에서 로컬 production preview를 사용했습니다.

- 실제 Web Worker ZK 생성·검증 및 기준 금액 변조 거부.
- 실제 DojangAttesterBook의 proxy implementation ABI에서 register/getRoleAdmin 함수를 확인했습니다.
- 로컬 Anvil을 연결한 EIP-1193 테스트 provider로 UI의 지갑 연결 → 스키마 준비 → 전송 → 확정 영수증/UID 전체 경로 확인.
- 지갑 EIP-712 서명 요청 후 원문/서명자 검증 성공.
- 한영 전환, 라이트·다크, 새로고침 후 선택 유지, 390px 모바일 가로 넘침 없음, 런타임 예외 없음.
- 거래 hash를 제출 직후 보관하고 receipt 대기 실패 시 유지합니다. 최근 실행 목록에는 공개 hash·상태만 탭 세션에 저장하며 원문·서명·calldata·비밀 키를 저장하지 않습니다.

실제 MetaMask 확장의 승인 창과 실제 모바일 기기/SDK relay 완료는 자동화하지 않았습니다. 위 wallet UI 검증은 로컬 fork용 provider를 주입한 테스트입니다.

## 공개 GIWA 읽기 검증

`npm run test:live`: **블록 38,034,662**, 조회 레코드 50개, 현재 스키마 4개, 현재 등록 발행자 10개, 배포 계약 10개. 상세·schema·tx·지갑 인덱스·이전 기록·RPC CORS·현재 EAS 도메인·오프체인 취소 조회 성공.

SchemaBook과 DojangAttesterBook의 현재 조회 결과:

| 역할 | 현재 확인된 주소 |
|---|---|
| DEFAULT_ADMIN_ROLE | `0xE3Fd5228AC2D2C15856959F9e27a4671c5d45958` |
| UPGRADER_ROLE | `0xd72b48Ed00b67D756408a140435D8ef101f4a377` |

주소를 하드코딩해 판정하지 않습니다. 역할 이벤트에서 후보를 찾고 해당 블록의 `hasRole`로 확인합니다. 등록과 발급 허용도 독립된 상태입니다.

## 현재 범위

새 receipt/verifier는 **공개 GIWA에 미배포**입니다. 사용자가 별도 배포한 receipt 주소를 넣으면 UI에서 정책을 조회하고 원본 수신 지갑으로 registerProof를 실행할 수 있습니다. 현재 balance 프로필은 원본 취소·은행 사실 확인·Dojang 발행자 허용을 증명하지 않으며 `sourceRevocationProven=false`를 기록합니다.

WASM 때문에 Vite 청크 크기 경고가 남습니다. 회로 및 proof worker는 사용자가 실행할 때 불러옵니다. 공개 RPC/explorer와 CRS의 CORS·가용성이 필요합니다. 사이트 호스팅 설정, Snap 코드, 자동 배포 워크플로는 추가하지 않았습니다.

사용 단계와 계약 권한은 [역할별 사용법](workflows.md), 회로 입력과 빌드 재현은 [ZK 문서](../zk/README.md)를 참고하세요.
