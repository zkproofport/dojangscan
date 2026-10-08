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

**Coming soon.** 본인 지갑의 유효한 Dojang 도장을 모바일 앱에서 증명하고 웹에서 결과를 받는 흐름을 준비 중입니다. 현재는 증명 요청·생성·검증을 실행하지 않습니다.

**Coming soon.** The planned flow proves valid Dojang attestations for your wallet in the mobile app and returns the result to the web. Proof requests, generation, and verification are not active yet.
