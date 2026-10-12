<p align="center">
  <a href="https://dojangscan.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="public/brand/dojang-scan-dark.svg">
      <img src="public/brand/dojang-scan.svg" alt="Dojang Scan logo" width="80" height="80">
    </picture>
  </a>
</p>

<h1 align="center">Dojang Scan</h1>

<p align="center">
  GIWA 도장 조회와 관리<br>
  Explore and manage attestations on GIWA Sepolia.
</p>

<p align="center">
  <a href="https://dojangscan.com/"><strong>Open Dojang Scan ↗</strong></a> ·
  <a href="https://dojangscan.com/?view=guide">Guide</a> ·
  <a href="#한국어">한국어</a> ·
  <a href="#english">English</a>
</p>

<p align="center">Powered by <a href="https://masselabs.com/"><strong>Masse Labs</strong></a></p>

---

## 한국어

Dojang Scan은 GIWA Sepolia의 도장과 발행자를 조회하고, 권한이 있는 지갑으로 발급·등록·권한 관리를 실행하는 서비스입니다. 공개 기록 조회에는 지갑 연결이 필요하지 않습니다.

| 기능 | 할 수 있는 일 |
| --- | --- |
| **도장 탐색** | 지갑·UID·트랜잭션 검색, 스키마와 발행자 조회, 등록 여부·취소·만료 확인 |
| **테스트 도장 체험** | GIWA Playground에서 발급받고 같은 지갑의 온체인 기록 확인 |
| **발행자·관리자** | 도장 발급·취소, 발행자·스키마 등록 관리, 역할·resolver 권한 관리 |
| **Contract Console** | 검증된 ABI로 함수 조회, 시뮬레이션, 지갑을 통한 실행 |
| **Proof Studio · Coming soon** | 내 도장 → ZKProofport 모바일 증명 → 웹에서 결과 확인. 현재는 소개와 앱 다운로드 제공 |

한국어·영어 · 라이트·다크 테마 · 공유 링크 · JSON 내보내기

**직접 사용해 보기:** [테스트 도장 발급 가이드](https://dojangscan.com/?view=guide)에서 시작하세요. 운영 작업은 [발행자·관리자 사용법](docs/workflows.md)을 참고하세요.

<details>
<summary>데이터와 권한 확인 기준</summary>

EAS는 도장 기록을 저장하는 기반 계약이며, Dojang은 등록 스키마·발행자·발급 규칙을 구성합니다. 발행자 이름은 [GIWA 공식 ID 문서](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts), 현재 주소와 등록 여부는 `getAttester(ID)`를 기준으로 표시합니다. 알 수 없는 이름을 추정하지 않습니다.

관리자 역할, 발행자 등록, 실제 발급 권한은 별개이며 대상 계약이 권한을 검사합니다. 컨트랙트 발행자는 Console에서 해당 발급 함수를 호출합니다. 통계는 조회된 범위이며 전체 체인 수치가 아닙니다.

</details>

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

### GitHub Pages

`main`에 푸시하면 GitHub Actions에서 테스트·빌드 후 `dist/`를 자동 배포합니다. [배포 상태](https://github.com/zkproofport/dojangscan/actions/workflows/pages.yml)

## English

Dojang Scan lets you explore GIWA Sepolia attestations and issuers, and manage issuance, registrations, and permissions with an authorized wallet. Browsing public records requires no wallet connection.

| Feature | What you can do |
| --- | --- |
| **Explore** | Search wallets, UIDs, and transactions; inspect schemas, issuers, registration, revocation, and expiration |
| **Test attestations** | Issue in GIWA Playground, then check the same wallet's onchain record |
| **Issuers & roles** | Issue and revoke attestations; manage issuer/schema registrations, roles, and resolver permissions |
| **Contract Console** | Load verified ABIs, read functions, simulate calls, and execute through a wallet |
| **Proof Studio · Coming soon** | Your attestation → ZKProofport mobile proof → result on the web. Currently provides an introduction and app downloads |

Korean & English · Light & dark themes · Share links · JSON export

**Try it:** start with the [test attestation guide](https://dojangscan.com/?view=guide). For management tasks, see the [operator guide](docs/workflows.md).

<details>
<summary>Data sources and permissions</summary>

EAS stores attestation records; Dojang adds registered schemas, issuers, and issuance rules. Issuer names use [GIWA's documented IDs](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts). Current addresses and registration come from `getAttester(ID)`; unknown names are not inferred.

Administrator roles, issuer registration, and issuance permission are separate; target contracts enforce access. Contract-based issuers use their own issuance functions through the Console. Counts cover loaded records, not the entire chain.

</details>

### Run

Requires Node.js 22.13 or newer. Run `npm ci` and `npm run dev`, then open <http://127.0.0.1:4317>. Wallet actions use **GIWA Sepolia (91342)**.

Validation: `npm run check`, `npm test`, `npm run build`. `npm run test:live` performs read-only public-chain checks while the development server is running.

### GitHub Pages

Pushes to `main` run tests, build, and deploy `dist/` through GitHub Actions. [Deployment status](https://github.com/zkproofport/dojangscan/actions/workflows/pages.yml)

---

React + TypeScript + Vite · Static build: `dist/` · Public GIWA RPC & explorer APIs · No application server or API key required.

[Dojang docs](https://docs.giwa.io/giwa-ecosystem/dojang) · [Contracts](https://github.com/giwa-io/dojang) · [Operator guide](docs/workflows.md)

Powered by **[Masse Labs](https://masselabs.com)**
