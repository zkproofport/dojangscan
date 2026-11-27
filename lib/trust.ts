import { PLAYGROUND_ATTESTER_ID } from "./issuer-metadata";
import { TEST_ATTESTER, type Governance, type Issuer, type IssuerClass } from './giwa';

export function classifyIssuer(address: string, issuers: Issuer[], governance: Governance, complete: boolean) {
 const same = (value: string) => value.toLowerCase() === address.toLowerCase();
 const registered = issuers.some(i => same(i.address));
 const managementRole = governance.roles.some(r => r.active === true && r.role === 'admin' && same(r.address));
 const issuerClass: IssuerClass = same(TEST_ATTESTER) ? 'test' : issuers.some(i => same(i.address) && i.id.toLowerCase() === PLAYGROUND_ATTESTER_ID) ? 'playground' : registered ? 'registered' : managementRole ? 'manager' : complete ? 'external' : 'unknown';
 return { issuerClass, registeredIssuer: registered, managementRole };
}

export const ISSUER_LABELS: Record<IssuerClass, string> = {
 playground: '테스트넷 도장', registered: 'Dojang 등록', manager: '관리 주소 발급', test: 'ZKProofport 테스트', external: '일반 EAS 발행자', unknown: '등록 여부 미확인',
};
export const ISSUER_EXPLANATIONS: Record<IssuerClass, string> = {
 playground: '공식 문서의 TESTNET FAUCET ID에 현재 등록된 발행자입니다. 테스트용 도장이며 실제 KYC 완료를 의미하지 않습니다.',
 registered: 'DojangAttesterBook의 현재 발행자 주소와 일치합니다. GIWA가 직접 발급했다는 뜻은 아닙니다.',
 manager: '공식 관리 컨트랙트의 현재 관리자 권한을 가진 주소입니다. 발행자 등록과는 별개입니다.',
 test: 'ZKProofport의 CIP-4에 명시된 MockGiwaAttester입니다. 실제 고객확인이나 금융기관 자격을 뜻하지 않습니다.',
 external: '발견한 현재 Dojang 발행자 목록에 없는 EAS 발행자입니다. 신뢰 여부는 별도로 판단하세요.',
 unknown: '발행자 목록 조회가 불완전해 등록 여부를 판정할 수 없습니다.',
};
