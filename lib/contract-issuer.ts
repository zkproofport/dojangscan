import {
  AbiCoder,
  Interface,
  ZeroAddress,
  getAddress,
  isHexString,
} from "ethers";
import { fetchVerifiedABI } from "./contract-console";
import { NETWORK, SCHEMAS } from "./giwa";
import { rpc } from "./scan-data";
import { encodeFields, type PreparedCall } from "./workspace";

// Explicit adapter for MasseDojangAttester-compatible contracts. Never send the
// EAS ABI to an arbitrary issuer or treat an operator as the EAS attester.
export const CONTRACT_ISSUER_ABI = [
  "function operators(address) view returns(bool)",
  "function issuancePaused() view returns(bool)",
  "function VERIFIED_ADDRESS_SCHEMA() view returns(bytes32)",
  "function BALANCE_ROOT_SCHEMA() view returns(bytes32)",
  "function VERIFIED_BALANCE_SCHEMA() view returns(bytes32)",
  "function VERIFIED_CODE_SCHEMA() view returns(bytes32)",
  "function attestVerifiedAddress(address recipient,uint64 expirationTime) returns(bytes32)",
  "function attestBalanceRoot(uint256 coinType,uint64 snapshotAt,uint192 leafCount,uint256 totalAmount,bytes32 merkleRoot,uint64 expirationTime) returns(bytes32)",
  "function attestVerifiedBalance(address recipient,uint256 balance,bytes32 salt,bytes32[] proofs,bytes32 rootUID,uint64 expirationTime) returns(bytes32)",
  "function attestVerifiedCode(bytes32 codeHash,string domain,uint64 expirationTime) returns(bytes32)",
  "function revokeAttestation(bytes32 uid)",
];
const abi = new Interface(CONTRACT_ISSUER_ABI);
const schemaFunctions = {
  address: ["attestVerifiedAddress", "VERIFIED_ADDRESS_SCHEMA"],
  root: ["attestBalanceRoot", "BALANCE_ROOT_SCHEMA"],
  balance: ["attestVerifiedBalance", "VERIFIED_BALANCE_SCHEMA"],
  code: ["attestVerifiedCode", "VERIFIED_CODE_SCHEMA"],
} as const;
export function contractIssuerSchema(uid: string) {
  return SCHEMAS.find((s) => s.uid.toLowerCase() === uid.toLowerCase());
}
export type ContractIssuerInput = {
  target: string;
  schema: string;
  definition: string;
  values: string;
  recipient: string;
  expiration: string;
  refUID: string;
  id: string;
};
function nonzeroUID(value: string) {
  if (!isHexString(value, 32) || BigInt(value) === 0n)
    throw new Error("Enter a nonzero bytes32 ID.");
  return value;
}
export function prepareContractIssuerCall(
  operation: string,
  input: ContractIssuerInput,
): PreparedCall {
  const to = getAddress(input.target);
  if (to === ZeroAddress) throw new Error("Enter a nonzero address.");
  let fn: string;
  let args: unknown[];
  if (operation === "revoke") {
    fn = "revokeAttestation";
    args = [nonzeroUID(input.id)];
  } else if (operation === "attest") {
    const schema = contractIssuerSchema(input.schema);
    if (!schema || input.definition !== schema.definition)
      throw new Error(
        "이 컨트랙트 발급 화면은 공식 네 가지 스키마만 지원합니다.",
      );
    if (
      !/^\d+$/.test(input.expiration) ||
      BigInt(input.expiration) >= 2n ** 64n
    )
      throw new Error("Enter a uint64 timestamp.");
    const expiration = BigInt(input.expiration);
    const encoded = encodeFields(schema.definition, input.values);
    const values = AbiCoder.defaultAbiCoder().decode(
      schema.definition.split(","),
      encoded,
    );
    const recipient = () => {
      const result = getAddress(input.recipient);
      if (result === ZeroAddress) throw new Error("Enter a nonzero address.");
      return result;
    };
    fn = schemaFunctions[schema.key][0];
    switch (schema.key) {
      case "address":
        if (values[0] !== true)
          throw new Error("이 컨트랙트는 isVerified=true로 발급합니다.");
        args = [recipient(), expiration];
        break;
      case "root":
        args = [...values, expiration];
        break;
      case "balance":
        args = [recipient(), ...values, nonzeroUID(input.refUID), expiration];
        break;
      case "code":
        args = [...values, expiration];
        break;
    }
  } else {
    throw new Error("Unsupported operation.");
  }
  return {
    chainId: NETWORK.chainId,
    to,
    data: abi.encodeFunctionData(fn, args),
    value: "0x0",
    operation: fn,
    attester: to,
  };
}

export async function inspectContractIssuer(
  call: PreparedCall,
  caller: string,
  schemaUID: string,
  dependencies = { rpc, fetchVerifiedABI },
) {
  const { rpc, fetchVerifiedABI } = dependencies;
  const block = await rpc("eth_blockNumber", []);
  if ((await rpc("eth_getCode", [call.to, block])) === "0x")
    throw new Error(
      "선택한 주소는 컨트랙트가 아닙니다. 발급 방식을 확인하세요.",
    );
  const verified = new Interface(await fetchVerifiedABI(call.to));
  const schema = contractIssuerSchema(schemaUID);
  const issuing = call.operation !== "revokeAttestation";
  const getter = issuing && schema ? schemaFunctions[schema.key][1] : null;
  if (issuing && !getter)
    throw new Error(
      "이 컨트랙트 발급 화면은 공식 네 가지 스키마만 지원합니다.",
    );
  const functions = [
    call.operation,
    "operators",
    ...(issuing ? ["issuancePaused", getter!] : []),
  ];
  for (const name of functions) {
    const expected = abi.getFunction(name)!;
    const actual = verified.getFunction(expected.format("sighash"));
    // Inputs are matched by the signature; output types and mutability must
    // also match. Parameter names do not affect compatibility.
    if (
      !actual ||
      actual.stateMutability !== expected.stateMutability ||
      actual.outputs.map((p) => p.format("sighash")).join() !==
        expected.outputs.map((p) => p.format("sighash")).join()
    )
      throw new Error(
        "이 계약의 발급 방식은 지원하지 않습니다. Contract Console을 사용하세요.",
      );
  }
  const read = async (fn: string, args: unknown[] = []) =>
    abi.decodeFunctionResult(
      fn,
      await rpc("eth_call", [
        { to: call.to, data: abi.encodeFunctionData(fn, args) },
        block,
      ]),
    )[0];
  if (!(await read("operators", [getAddress(caller)])))
    throw new Error("연결 지갑에 이 컨트랙트의 운영 권한이 없습니다.");
  if (issuing) {
    if (await read("issuancePaused"))
      throw new Error("이 컨트랙트의 신규 발급이 일시정지되어 있습니다.");
    if (String(await read(getter!)).toLowerCase() !== schemaUID.toLowerCase())
      throw new Error("컨트랙트의 스키마가 선택한 스키마와 다릅니다.");
  }
}
