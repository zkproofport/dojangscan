export const NETWORK = { name: 'GIWA Sepolia', chainId: 91342, rpc: 'https://sepolia-rpc.giwa.io', explorer: 'https://sepolia-explorer.giwa.io' } as const;
export const ZERO = '0x' + '0'.repeat(64);
export const CONTRACTS = {
 EAS: '0x4200000000000000000000000000000000000021', SchemaRegistry: '0x4200000000000000000000000000000000000020',
 SchemaBook: '0x78cBb3413FBb6aF05EF1D21e646440e56baE3AD6', DojangAttesterBook: '0xDA282E89244424E297Ce8e78089B54D043FB28B6',
 AttestationIndexer: '0x9C9Bf29880448aB39795a11b669e22A0f1d790ec', DojangScroll: '0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9',
 AddressDojangResolver: '0x692009FE206C3F897867F6BF7B5B45506B747F9e', BalanceRootDojangResolver: '0xD90a964aB65bc02397De1E7fcBd230803bC1bEd0',
 BalanceDojangResolver: '0x6FFa7ABc1E380Bb967C78D5E648EF804e1fE6dAd', VerifyCodeDojangResolver: '0x843fF433f7657901118fF3E2Eca915abb9BC12Df',
} as const;
export const TEST_ATTESTER = "0x6646d970499bbed728636823a5a7e551e811b414";
export const SCHEMAS = [
 { key: 'address', name: 'Verified Address', label: '주소 인증', category: 'Identity', color: 'blue', id: '0x568eb581cdf80b03d3bdfa414f3203bfdcc4bba4e66355612bd0e879da812f06', uid: '0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08', definition: 'bool isVerified', description: '발행자가 확인한 지갑 주소. 실제 신원 정보 대신 인증 여부를 기록합니다.' },
 { key: 'root', name: 'Balance Root', label: '잔액 스냅샷', category: 'Finance', color: 'violet', id: '0xf09c1384d860519bb4ea5bb2a45ab64b00a8d900d47fb79203663be6da21e06c', uid: '0x369faa9c2cd261c45be3db5e230b585f5f1abecf8e12be575bb543e917e6db52', definition: 'uint256 coinType,uint64 snapshotAt,uint192 leafCount,uint256 totalAmount,bytes32 root', description: '특정 시점의 잔액들을 묶은 Merkle root. 개별 잔액 도장을 검증하는 기준입니다.' },
 { key: 'balance', name: 'Verified Balance', label: '잔액 인증', category: 'Finance', color: 'green', id: '0x06c3bd846f5ea60b0b6f5a835ef85fd8253b53f67917d6c690be628d032f841b', uid: '0x77bf88ca262cc63e1b185dccd870aacc5320b8987ef6c7169920f265fe6ab5e9', definition: 'uint256 balance,bytes32 salt,bytes32[] proofs', description: '잔액과 Merkle 경로를 담은 도장. 연결된 잔액 스냅샷과 함께 확인합니다.' },
 { key: 'code', name: 'Verified Code', label: '코드 인증', category: 'Access', color: 'orange', id: '0x68053e055c01ce9b3577f3162b36324bb195ebcb574c48e823480d205f06af9b', uid: '0x55ac1369dac97522d062b89ffdc4e752b48fbeba86915fdb956c7c2d0501d280', definition: 'bytes32 codeHash,string domain', description: '외부에서 전달한 인증 코드의 해시와 도메인을 기록합니다.' },
] as const;
export const UPBIT_ID = '0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034';
export function short(value: string, n = 6) { return value.length > n * 2 + 2 ? `${value.slice(0, n + 2)}…${value.slice(-n)}` : value; }
export type SchemaRecord = { uid: string; id?: string; name: string; label: string; category: string; color: string; definition: string; description: string; resolver: string; revocable: boolean; current: boolean; registered: boolean };
export type Issuer = { id: string; address: string; name: string; tx: string };
export type GovernanceRole = { contract: 'SchemaBook' | 'DojangAttesterBook'; address: string; role: 'admin' | 'upgrader'; roleId: string; active: boolean | null; tx: string };
export type Governance = { roles: GovernanceRole[]; complete: boolean; block: number };
export type IssuerClass = 'playground' | 'registered' | 'manager' | 'test' | 'external' | 'unknown';
export type Attestation = { uid: string; schema: string; recipient: string; attester: string; time: number; expirationTime: number; revocationTime: number; revocable: boolean; refUID: string; data: string; status: 'active' | 'expired' | 'revoked'; fields: { name: string; type: string; value: string }[]; schemaName: string; schemaLabel: string; schemaCurrent: boolean; dojang: boolean; registeredIssuer: boolean; issuerClass: IssuerClass; managementRole: boolean; issuerName: string; issuerId?: string; tx?: string; block?: number; timestamp?: string };
export type ScanData = { block: number; checkedAt: string; schemas: SchemaRecord[]; issuers: Issuer[]; governance: Governance; issuerDiscoveryComplete: boolean; attestations: Attestation[]; next: Record<string, number> | null; warnings: string[]; coverage: string };
