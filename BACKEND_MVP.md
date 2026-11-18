# Dojangscan Frontend MVP — 최종 로컬 리뷰

기존 UI를 유지한 Backend MVP다. 이번 최종 점검에서는 UI 코드·운영 설정을 변경하지 않았고, 기존 미커밋 파일을 보존했다. HEAD는 `51ba052f3fdbded2b7b9b3de3d76df0a0c06dee1`, 현재 브랜치는 `main`이다.

## 실제 데이터와 운영 상태

연결은 Frontend127.0.0.1:4317 → Vite proxy → Mac SSH127.0.0.1:18094 → NUC127.0.0.1:18085다. 기존 서버·터널 프로세스(PID70926/70898)를 재사용했다. Live instance는 `giwa-sepolia-catchup25-r1`, Backend source는 `01341b370cdcf923cb822a90398d751e8d410be2`다. 예상 network/chain이 다른 응답은 거부한다.

2026-11-17 **19:46:22 KST**의 읽기 전용 DB/controller/systemd/서비스 진단 결과다. 원본 공개 결과는 Git 제외 `.local/live/evaluation-readonly-r1.json`이며 SHA-256은 `fb09e7bfd22d8fa6626522159d516cddfeb2dc2b73d0c8c9687286910e5548ce`다.

| 항목 | 관측값 |
|---|---|
| Timer | active / running / enabled |
| Worker | exit0, 74번째 run completed, error 없음, halted=null |
| Raw 마지막 / 다음 | 41,474,737 / 41,474,738 |
| Evaluated 마지막 | 41,472,564 (Raw와 2,173블록 차이) |
| 검증된 Raw 블록 | 2,528 (이번 운영 신규2,368) |
| finalized / 관측 시각 | 41,565,484 / 2026-11-17T10:46:05.260Z |
| 저장된 head 기준 backlog | 90,747 |
| 기간 원장 | 11,626wire / 추정425,824CU / 74runs |
| 미분류 / 미완료 작업 | 미분류26, hydrate failed1(UNKNOWN_SCHEMA·attempts1) |
| Coverage | partial, range_raw_complete=true, hydration_complete=false, range_evaluation_ready=false |
| 전역 판단 | Current Decision UNKNOWN |

Worker는 정상 배치 종료 직후이고 controller의 inFlight는 아직 true인 시점이다. Timer active·run completed·exit0·halted=null을 확인했으며 이를 장애 중단으로 해석하지 않는다. 상태들은 연속된 읽기 전용 조회 결과이므로 동일 원자적 시점이라고 주장하지 않는다. 기존 PG/API5개와 새 Live API까지6개의 ID·시작 시각·포트를 직전 증거와 대조해 동일함을 확인했다. 모두 running이며 PostgreSQL 호스트 포트는 없다. 종료는 승인된11월18일19:00 KST, 자동 갱신 없음이다.

### Evaluation 지연의 정확한 원인

- 최초 UID: `0xdc320c22d5e476a0d569a404d5dc01db0bbc4e0e38bd45ca66a8e2d449bbef2d`. 원본 `Revoked`는 **41,472,565**에서 관측됐고 첫 미분류 평가는 배치 끝 **41,472,593**에 저장됐다. 따라서 watermark41,472,564의 바로 다음 블록부터 범위 평가가 보장되지 않는다.
- 해당 payload는 decode=done이지만 issue_block/issue_hash가 null이고 Book·Indexer·reference 관계가 모두 false, historicalIssuance/applicability 증거가 없다. 이유는 `INSUFFICIENT_OR_REFERENCED`다. 이 경우 실제 referenced=true라는 뜻이 아니라 공통 오류 코드이며, 이 UID의 referenced는 false다. Book 미관측은 외부 EAS라는 증거가 아니다.
- 같은 유형의 원발급 근거 없는 Revoked UID가 현재 **25건**이다. issuer `0x63cce2b569a7bc35895ee24306c1512fefc06121`, schema `0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08`의 과거 발급 상태를 현재 수집만으로 확정하지 않는다.
- 별도 UID `0xf43e521c177dd9c05e504d6b59eb04aee8a4dba9a0067a0c35e1dde83d9136ee`는 **41,473,505**의 Attested를 직접 수집했다. schema `0xe7e2ce9d65a64e5a4b81aa5dfaaac67dfc6038454ef458349e42401d5c7618d3`의 payload가 unsupported여서 **41,473,521** 기준 분류와 hydrate `failed/UNKNOWN_SCHEMA`가 보존됐다. 원본 이벤트 ABI는119/119 해석됐고 inc_networks.unsupported=0, trustError=null이다. 이벤트 ABI 실패와 payload schema 미지원을 구분한다.
- 기존 승인 코드의 격리 검사는 canonical block·저장 payload·decode=unsupported·hydrate/UNKNOWN_SCHEMA를 만족하는 실패만 Raw 진행 예외로 허용한다. 실제 완료 배치도 quarantined=1, fullyEvaluated=false를 보고했다. 실패 행을 삭제하거나 성공으로 바꾸지 않았다.

기존에 검증된 개별 Historical Projection은 해당 관측 블록 기준으로 계속 조회할 수 있다. 뒤쪽 미분류로 인해 전체 범위 watermark가 정지한 것과 개별 기록의 원본 관측/철회 상태는 별개다. 초기 전체 이력도 불완전하므로 분류를 해소하더라도 즉시 전역 readiness나 ALLOW를 허용하지 않는다.

추가 주의: 저장된 finalized 관측이 b073의41,566,105에서 b074의41,565,484로621블록 낮아졌다. 공급자 응답의 높이 차이는 확인했으나 이것만으로 canonical reorg를 확정할 수 없다. 새 RPC·중단·정책 변경은 하지 않았다.

다음 복구는 Live를 유지한 별도 범위로 제안한다: 25UID의 과거 발급 블록/당시 Book·Indexer 증거를 먼저 식별하고, 1개 미지원 schema는 공식 정의와 저장 payload를 오프라인 대조한다. 추가 RPC가 필요하면 정확한 대상·요청 목록·wire/CU 상한을 고정해 별도 승인을 받아야 한다. 증거가 확보된 후의 DB import/재분류도 별도 승인 대상이다. 이번에는 탐색 RPC·DB 수정·새 API·재시작을 실행하지 않았다.

## 브라우저 QA와 사용자 점검

**실제 화면 확인 성공 항목은 없다.** 이번 Chrome 도구 연결도 timeout으로 실패했고 반복 시도하지 않았다. 목록·상세·필터·페이지네이션·출처 전환·한국어/영어·테마·모바일 폭은 실제 브라우저 점검이 남아 있다. HTTP 성공을 시각 QA 성공으로 기록하지 않는다. 화면에서 확인된 새 오류가 없으므로 UI 코드를 추측으로 수정하지 않았다.

1. [Backend 목록](http://127.0.0.1:4317/?view=explore&source=backend): Schema/Issuer 필터 → 초기화 → 다음 페이지 → 새로고침. partial·stale·미분류·UNKNOWN과 Raw/Evaluated 차이를 확인한다.
2. [실제 UID 상세/공유 링크](http://127.0.0.1:4317/?view=explore&source=backend&uid=0x154f293bfe0282747bfec5d581dadfa0462f51eb9c5e15760b2e8e3e8640aea8): 새로고침 후 같은 UID가 열리는지, 철회·만료·Indexer 선택이 별도인지 확인한다.
3. [미수집 UID](http://127.0.0.1:4317/?view=explore&source=backend&uid=0x0000000000000000000000000000000000000000000000000000000000000000): 503/UNKNOWN을 확정 부재로 표시하지 않는지 확인한다. [Public 탐색](http://127.0.0.1:4317/?view=explore&source=public)에서는 공개 RPC 출처를 확인한다.
4. 한국어/영어·다크/라이트와 모바일 폭에서 긴 UID/Hash·필터·상세 패널의 가로 넘침을 확인한다. 이 목록의 실사용 결과는 아직 제공되지 않았다.

프론트는 새로고침 때 cache=no-store로 목록/status를 다시 GET한다. 실제 proxy 응답의 블록 전진은 확인했지만 브라우저 시각 갱신은 미확인이다. 목록·status·상세는 각 응답의 기준 블록을 표시하며 서로 다른 snapshot을 합치지 않는다. 자동 polling은 없다.

## 데이터 의미와 기존 기능

- EAS active, 현재 Indexer 선택, Historical Projection과 Current Decision UNKNOWN을 구분한다. `not-selected`만으로 superseded나 revoked를 확정하지 않는다. ALLOW는 비활성화한다.
- 미수집503/UNKNOWN·필터 결과0건·연결 오류를 구분한다. 409는 새 snapshot 첫 페이지로 한 번만 돌아가며 Backend opaque cursor를 Public 숫자 cursor와 섞지 않는다. Backend 오류에서 Public으로 자동 fallback하지 않는다.
- Live API 미제공 refUID/철회 시각/전체 projection·Indexer 이력을 만들지 않는다. 관측 finalized는 저장된 head이며 실시간 head 조회가 아니다.
- 기존 scan-data, Code Explorer, Wallet, Schema catalog, Issuer/관리자, Proof Studio와 브랜딩·i18n·테마 구현을 보존했다. 해당 기능의 공개 RPC/Explorer 출처를 표시한다. 새 Backend 기능은 추가하지 않았다.

기존 실제 GET smoke6건, TypeScript/build, 집중 테스트9개 및 앞선 관련 회귀36개 통과 기록을 재사용했다. 코드 SHA가 기존 검토 후보와 일치해 이 검사들을 반복하지 않았다. 이번에는 status GET1건과 Git diff/후보 SHA 검토만 수행했다. 기존 proof-library build chunk 경고는 남는다.

## 안전한 Git 보존 후보

`MVP_COMMIT_CANDIDATE.json`에 코드·테스트·이 문서 등13개 파일의 SHA를 고정했다. 승인 후 만들 작업 브랜치 제안은 **work/frontend-backend-mvp**다. 아직 브랜치 생성·stage·commit·push는 하지 않았다. 승인 시 HEAD와 모든 SHA를 다시 대조하고 이 브랜치에서 후보의 명시적 경로만 stage한다. `git add .`는 사용하지 않는다.

환경별 `scripts/live-api/`, 로컬 결과 `MVP_RESULT.json`, 검토 manifest 자체, Secret·환경 파일·SSH 키·dump·.local·임시/build 결과는 commit 후보에서 제외하고 로컬에 보존한다. 기존 공개 workflow는 수정하지 않았다. `main` push는 Pages 자동 배포를 유발하므로 **main push·merge·배포는 별도 승인 전까지 금지**다. 작업 브랜치 push도 별도 승인이 필요하다.

## 공개 MVP 최소 구조

기존 GitHub Pages는 정적 dist 사이트다. 공개 API가 준비될 때까지 Public을 기본값으로 유지한다(현재 공개 workflow에는 Backend 환경 설정 없음).

- HTTPS edge/gateway에서 정적 Pages와 `/api/dojangscan` 경로를 분기하고, 승인된 Live instance의 GET만 API로 전달한다. 현재 상대경로 client를 재사용할 수 있다. 별도 API 도메인을 쓰면 base URL과 허용 frontend origin CORS가 추가로 필요하다.
- 최소 rate limit·timeout·응답 크기 제한·instance allowlist를 둔다. CORS는 인증 수단이 아니며 NUC 접근 경계는 gateway와 사설 연결/방화벽으로 제한한다.
- NUC localhost API를 그대로 인터넷에 공개하지 않고 PG 포트·DB/Nodit Secret을 외부에 전달하지 않는다. 개발용 SSH 터널/Vite proxy를 공개 서비스 구성에 사용하지 않는다.
- 공개 status는 checkpoint·coverage·관측 head 등 필요한 값만 제공하고 내부 운영 정책/예산 전체는 노출하지 않는다. stale·UNKNOWN·연결 실패 안내는 유지한다.

이번에는 공개 인프라 구축·배포·새 API·NUC 변경을 수행하지 않았다.
