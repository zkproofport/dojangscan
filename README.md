<p align="center">
  <a href="https://dojangscan.com/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="public/brand/dojang-scan-dark.svg">
      <img src="public/brand/dojang-scan.svg" alt="Dojangscan logo" width="80" height="80">
    </picture>
  </a>
</p>

<h1 align="center">Dojangscan</h1>

<p align="center">
  GIWA 도장 조회와 관리<br>
  Explore and manage attestations on GIWA Sepolia.
</p>

<p align="center">
  <a href="https://dojangscan.com/"><strong>Open Dojangscan ↗</strong></a> ·
  <a href="https://dojangscan.com/?view=guide">Guide</a> ·
  <a href="https://dojangscan.com/?view=brand">Brand kit</a> ·
  <a href="#한국어">한국어</a> ·
  <a href="#english">English</a>
</p>

<p align="center">Powered by <a href="https://masselabs.com/"><strong>Masse Labs</strong></a></p>

---

## 한국어

GIWA Sepolia의 도장을 검색하고, 누가 발급했는지와 현재 유효한지 확인하세요. 발행자와 관리자는 지갑을 연결해 도장 발급과 권한 관리를 할 수 있습니다.

| 기능 | 할 수 있는 일 |
| --- | --- |
| **도장 탐색** | 지갑·UID·트랜잭션 검색, 스키마와 발행자 조회, 등록 여부·취소·만료 확인 |
| **사용처별 조회** | 사용처 입력 후 찾기·Enter로 코드별 발급 내역 조회, 전달받은 코드 또는 공개 해시의 현재 유효성 확인 |
| **지갑·발행 이력** | 받은 도장과 발행한 도장 구분, 잔액·코드 인증 및 과거 기록 조회 |
| **테스트 도장 체험** | GIWA Playground에서 발급받고 같은 지갑의 온체인 기록 확인 |
| **발행자·관리자** | 지갑을 연결해 도장 발급·취소, 발행자·도장 종류 등록, 권한 관리 |
| **Contract Console** | 컨트랙트 함수 조회와 실행, 전송 전 시뮬레이션 |
| **Proof Studio** | Playground 발급 확인 → 모바일 ZK 증명 → GIWA Sepolia 검증 실습 ([연결 요건](docs/workflows.md#proof-studio)) |

지갑 연결 없이 조회 · 한국어·영어 · 라이트·다크 테마 · 공유 링크 · JSON 내보내기

**직접 사용해 보기:** [테스트 도장 발급 가이드](https://dojangscan.com/?view=guide)에서 시작하세요. 운영 작업은 [발행자·관리자 사용법](docs/workflows.md)을 참고하세요.

## English

Search attestations on GIWA Sepolia, see who issued them, and check their current status. Issuers and administrators can connect a wallet to issue attestations and manage permissions.

| Feature | What you can do |
| --- | --- |
| **Explore** | Search wallets, UIDs, and transactions; inspect schemas, issuers, registration, revocation, and expiration |
| **Browse by use case** | Enter a verification code use case, then press Find or Enter to load records; optional filters and validity checks |
| **Wallet & issuer history** | Browse received or issued attestations, including balance, code and historical records |
| **Test attestations** | Issue in GIWA Playground, then check the same wallet's onchain record |
| **Issuers & roles** | Connect a wallet to issue and revoke attestations, manage registrations, and control permissions |
| **Contract Console** | Read and execute contract functions, with simulation before sending a transaction |
| **Proof Studio** | Check Playground issuance → create a mobile ZK proof → verify on GIWA Sepolia ([requirements](docs/workflows.md#proof-studio)) |

Browse without connecting a wallet · Korean & English · Light & dark themes · Share links · JSON export

**Try it:** start with the [test attestation guide](https://dojangscan.com/?view=guide). For management tasks, see the [operator guide](docs/workflows.md).

---

[Website](https://dojangscan.com/) · [Guide](https://dojangscan.com/?view=guide) · [Dojang Docs](https://docs.giwa.io/giwa-ecosystem/dojang)

Powered by **[Masse Labs](https://masselabs.com)**

발급·만료·취소 시각은 기기 시간대에 맞춰 표시합니다(한국: GMT+9). 날짜 조건 공유 링크에는 기준 시간대를 보존하며, CSV의 원본 시각은 UTC입니다.

## Public Backend API configuration

GitHub Pages serves static assets only. The Vite proxies and SSH tunnel are local development tools. Production requires an independently deployed HTTPS gateway (or an actual same-origin reverse proxy).

Production defaults are pinned in `deployment/public-explorer.json`: `https://api.dojangscan.com/live` and `https://api.dojangscan.com/history`, instance `giwa-sepolia-catchup25-r1`. Public remains the default source, so an unavailable API does not replace the existing public Explorer. Explicit Backend links show connection errors, never an empty-success result or an automatic source substitution. Development retains its loopback Vite proxies.

`npm run build:public` produces the local `dist-public/` candidate with only these pinned public settings, excluding local env files and inherited `VITE_*` settings. The Pages workflow uses this same command and uploads `dist-public/`; only a `main` push or an explicit workflow dispatch deploys it. This local command does not deploy. Local TLS contract check: `node --import tsx scripts/check-public-https.mts <local-test-CA.pem>` against the isolated Mac harness on `127.0.0.1:18443`; it never connects to the public API hostname.

The Pages build injects only the two public URLs and the public instance ID from that file, and ignores local env files and inherited `VITE_*`. Other development builds may use these settings:

- `VITE_DOJANGSCAN_NETWORK=giwa-sepolia-catchup25-r1`
- `VITE_DOJANGSCAN_API_BASE=https://<approved-api-host>/live`
- `VITE_DOJANGSCAN_HISTORY_API_BASE=https://<approved-api-host>/history`
- `VITE_DOJANGSCAN_SOURCE=public` (retain Public as the default until public API activation)

The URL settings reject HTTP, embedded credentials, query strings and fragments. Never put tokens, DB URLs or Nodit keys in `VITE_*` variables: they are public build data. Both clients use credential-free GETs and retain explicit API errors without automatic Public fallback. The existing Pages workflow is unchanged; committing to this working branch does not deploy it. Build-environment configuration and any main merge/push remain separate release actions.
