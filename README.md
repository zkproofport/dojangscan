# Dojang Scan

[한국어](#한국어) · [English](#english)

## 한국어

GIWA Sepolia의 Dojang을 조회하고 관리하는 웹앱입니다.

- **탐색**: 도장·스키마·발행자 조회, 지갑·UID·트랜잭션 검색, 등록 여부와 유효 상태 확인.
- **발행자·관리자**: 한 화면에서 역할별 목록과 실행 폼 전환, 이름·주소 검색, 5개씩 페이지 조회.
- **발행자**: 등록된 Dojang 스키마로 발급·취소. 실행 전 시뮬레이션과 지갑 승인.
- **관리자**: 발행자·스키마 등록/해제, 역할 부여/회수, resolver 발급 권한과 설정 관리.
- **Contract Console**: 실제 컨트랙트 ABI 조회, 함수 읽기·시뮬레이션·지갑 실행.
- **Proof Studio — Coming soon**: 내 도장 선택 → ZKProofport 모바일 증명 → 웹에서 결과 확인. 현재는 안내와 iOS·Android 다운로드를 제공합니다.
- 한국어·영어, 라이트·다크 테마, 공유 링크와 JSON 저장.

EAS는 도장 기록을 저장하는 기반 계약입니다. Dojang은 그 위에 등록 스키마·발행자·발급 규칙을 구성합니다. 관리자 역할, 발행자 등록, 실제 발급 권한은 별개이며 계약이 권한을 검사합니다. 발행자가 컨트랙트인 경우 운영 지갑에서 Console로 해당 발행 함수를 호출합니다.

### 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm ci
npm run dev
```

<http://127.0.0.1:4317> · 지갑 실행 네트워크: **GIWA Sepolia (91342)**

```bash
npm run check
npm test
npm run build
npm run test:live # 개발 서버 실행 중, 공개 체인 읽기 전용 검사
```

## English

Explore and manage Dojang on GIWA Sepolia.

- **Explore**: browse attestations, schemas, and issuers; search wallets, UIDs, and transactions; check registration and validity.
- **Issuers & administrators**: one area with role directories, action forms, name/address search, and five-row pagination.
- **Issuers**: issue and revoke attestations using registered Dojang schemas, with simulation and wallet approval.
- **Administrators**: manage issuer/schema registrations, contract roles, and resolver permissions and settings.
- **Contract Console**: load real contract ABIs, read functions, simulate calls, and execute through a wallet.
- **Proof Studio — Coming soon**: select your attestation → prove in ZKProofport on mobile → view the result on the web. Currently provides a preview and iOS/Android download links.
- Korean/English, light/dark themes, share links, and JSON export.

EAS provides the underlying attestation contracts. Dojang adds registered schemas, issuers, and issuance rules. Administrator roles, issuer registration, and issuance permission are separate; contracts enforce access. Contract-based issuers are operated through their own functions in the Console.

### Run

Requires Node.js 22.13 or newer. Run `npm ci` and `npm run dev`, then open <http://127.0.0.1:4317>. Wallet actions use **GIWA Sepolia (91342)**.

Validation: `npm run check`, `npm test`, `npm run build`. `npm run test:live` performs read-only public-chain checks while the development server is running.

---

React + TypeScript + Vite. Static build: `dist/`. Public GIWA RPC and explorer APIs; no application server or API key required. Counts cover loaded records, not the entire chain.

[Dojang docs](https://docs.giwa.io/giwa-ecosystem/dojang) · [Contracts](https://github.com/giwa-io/dojang) · [Operator guide](docs/workflows.md)

Powered by **[Masse Labs](https://masselabs.com)**
