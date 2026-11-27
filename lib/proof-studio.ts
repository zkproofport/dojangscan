import {
  Contract,
  JsonRpcProvider,
  TypedDataEncoder,
  ZeroHash,
  concat,
  getAddress,
  keccak256,
  toBeHex,
  toUtf8Bytes,
} from "ethers";
import { MOCK_KYC_SIGNER } from "./mock-kyc";
import type { RelayProofResult, TypedAction } from "@zkproofport-app/sdk";

export const STUDIO_CIRCUIT = "dojang_playground";
export const STUDIO_CHAIN = 91342;
export const STUDIO_VERIFIER = "0x2d01c2fe3445b7dde60118f956bb14e84fd64724";
export const STUDIO_RELAY = "https://relay.zkproofport.app";
export const STUDIO_SCOPE = "dojangscan:playground:v1";
export const STUDIO_WAIT_MS = 300_000;

export type StudioCircuit = "dojang_playground" | "giwa_attestation";
export const STUDIO_PROFILES = {
  dojang_playground: {
    verifier: STUDIO_VERIFIER,
    scope: STUDIO_SCOPE,
    count: 160,
    scopeOffset: 96,
    nullifierOffset: 128,
  },
  giwa_attestation: {
    verifier: "0x5da234546874304f8c51bbeed00fc632938211c1",
    scope: "dojangscan:mock-kyc:v1",
    count: 192,
    scopeOffset: 128,
    nullifierOffset: 160,
  },
} as const;
export const MOCK_KYC_SIGNER_ROOT = keccak256(MOCK_KYC_SIGNER);

export function practiceAction(
  session: string,
  circuit: StudioCircuit = STUDIO_CIRCUIT,
): TypedAction {
  if (!/^0x[0-9a-f]{64}$/i.test(session))
    throw new Error("Invalid practice session");
  return {
    domain: {
      name: "Dojangscan Proof Studio",
      version: "1",
      chainId: STUDIO_CHAIN,
      verifyingContract: STUDIO_PROFILES[circuit].verifier,
    },
    primaryType: "Practice",
    types: { Practice: [{ name: "session", type: "bytes32" }] },
    message: { session },
  };
}

export function walletNullifier(
  address: string,
  circuit: StudioCircuit = STUDIO_CIRCUIT,
): string {
  const tag = keccak256(toUtf8Bytes(circuit));
  return keccak256(
    concat([
      keccak256(concat([getAddress(address), tag])),
      keccak256(toUtf8Bytes(STUDIO_PROFILES[circuit].scope)),
    ]),
  );
}

export type StudioProof = {
  circuit: StudioCircuit;
  requestId: string;
  proof: string;
  publicInputs: string[];
  nullifier: string;
  response: RelayProofResult;
};

/** Relay metadata alone is not evidence: bind every public field to this practice. */
export function prepareStudioProof(
  result: RelayProofResult,
  requestId: string,
  address: string,
  action: TypedAction,
  circuit: StudioCircuit = STUDIO_CIRCUIT,
): StudioProof {
  const profile = STUDIO_PROFILES[circuit];
  if (result.requestId !== requestId)
    throw new Error("다른 요청의 증명이 도착했습니다. 새로 시작해 주세요.");
  if (
    result.status !== "completed" ||
    result.circuit !== circuit ||
    result.chainId !== STUDIO_CHAIN ||
    result.verifierAddress?.toLowerCase() !== profile.verifier
  ) {
    throw new Error("선택한 유형의 올바른 증명 결과가 아닙니다.");
  }
  if (
    typeof result.proof !== "string" ||
    !/^0x(?:[0-9a-f]{2})+$/i.test(result.proof)
  )
    throw new Error("증명 데이터가 비어 있거나 잘못되었습니다.");
  const inputs = result.publicInputs;
  if (
    !Array.isArray(inputs) ||
    inputs.length !== profile.count ||
    inputs.some(
      (v) =>
        typeof v !== "string" ||
        !/^0x[0-9a-f]{1,64}$/i.test(v) ||
        BigInt(v) > 255n,
    )
  ) {
    throw new Error("증명의 공개 입력 형식이 올바르지 않습니다.");
  }
  const field = (offset: number) =>
    "0x" +
    inputs
      .slice(offset, offset + 32)
      .map((v) => BigInt(v).toString(16).padStart(2, "0"))
      .join("");
  if (
    field(0) !== ZeroHash ||
    field(32) !== TypedDataEncoder.hashDomain(action.domain) ||
    field(64) !==
      TypedDataEncoder.hashStruct(
        action.primaryType,
        action.types,
        action.message,
      ) ||
    field(profile.scopeOffset) !== keccak256(toUtf8Bytes(profile.scope))
  ) {
    throw new Error(
      "이번 실습 요청에 대한 증명이 아닙니다. 새로 생성해 주세요.",
    );
  }
  if (circuit === "giwa_attestation" && field(96) !== MOCK_KYC_SIGNER_ROOT)
    throw new Error("허용된 목업 발급자의 증명이 아닙니다.");
  if (field(profile.nullifierOffset) !== walletNullifier(address, circuit))
    throw new Error(
      "조회한 지갑과 앱에서 서명한 지갑이 다릅니다. 발급에 사용한 같은 지갑을 선택해 주세요.",
    );
  return {
    circuit,
    response: structuredClone(result),
    requestId,
    proof: result.proof,
    publicInputs: inputs.map((v) => toBeHex(BigInt(v), 32)),
    nullifier: field(profile.nullifierOffset),
  };
}

/** eth_call only: verification never sends a transaction or asks for a browser wallet. */
export async function verifyStudioProof(proof: StudioProof): Promise<boolean> {
  const provider = new JsonRpcProvider(
    "https://sepolia-rpc.giwa.io",
    STUDIO_CHAIN,
  );
  try {
    const verifier = new Contract(
      STUDIO_PROFILES[proof.circuit].verifier,
      [
        "function verify(bytes proof,bytes32[] publicInputs) view returns (bool)",
      ],
      provider,
    );
    try {
      return (await verifier.verify(proof.proof, proof.publicInputs)) === true;
    } catch (error) {
      // Do not render ethers' full calldata (the proof) in a user-facing error.
      if ((error as { code?: string }).code === "CALL_EXCEPTION") return false;
      throw new Error(
        "검증 네트워크에 연결하지 못했습니다. 잠시 후 다시 검증해 주세요.",
      );
    }
  } finally {
    provider.destroy();
  }
}

/** Reassemble the circuit's byte-valued fields for inspection, preserving the raw response separately. */
export function studioPublicFields(proof: StudioProof) {
  const definitions = [
    ["signal_hash", "이 실습에서는 사용하지 않는 값 (0)"],
    ["domain_hash", "증명을 요청한 서비스의 도메인 해시"],
    ["action_hash", "이번 실습 요청의 해시"],
    ...(proof.circuit === "giwa_attestation"
      ? [["signer_list_merkle_root", "허용된 목업 발급자 목록의 Merkle root"]]
      : []),
    ["scope_hash", "실습 범위를 구분하는 해시"],
    ["nullifier", "같은 지갑과 범위를 연결하는 식별값"],
  ];
  return definitions.map(([name, description], index) => ({
    name,
    description,
    start: index * 32,
    end: index * 32 + 31,
    value:
      "0x" +
      proof.publicInputs
        .slice(index * 32, (index + 1) * 32)
        .map((value) => BigInt(value).toString(16).padStart(2, "0"))
        .join(""),
  }));
}

/** A literal address check, not an anonymity or information-leakage test. */
export function responseContainsAddress(proof: StudioProof, address: string) {
  const needle = getAddress(address).slice(2).toLowerCase();
  return (
    JSON.stringify(proof.response).toLowerCase().includes(needle) ||
    studioPublicFields(proof).some((field) =>
      field.value.toLowerCase().includes(needle),
    )
  );
}
