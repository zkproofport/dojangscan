import { Interface, type InterfaceAbi, type FunctionFragment } from "ethers";
import { NETWORK } from "./giwa";
import { rpc } from "./scan-data";
import type { PreparedCall } from "./workspace";
export async function fetchVerifiedABI(address: string) {
  const response = await fetch(
    `${NETWORK.explorer}/api/v2/smart-contracts/${address}`,
    { signal: AbortSignal.timeout(20_000) },
  );
  if (!response.ok)
    throw new Error(
      `Verified ABI unavailable (${response.status}). Paste an ABI below.`,
    );
  const result = await response.json();
  let abi = result.abi;
  const implementationAddress =
    result.implementations?.[0]?.address_hash ||
    result.implementations?.[0]?.address;
  if (implementationAddress) {
    const implementation = await fetch(
      `${NETWORK.explorer}/api/v2/smart-contracts/${implementationAddress}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    if (implementation.ok) {
      const impl = await implementation.json();
      if (impl.abi)
        abi = [
          ...(abi || []).filter((entry: { type?: string } | string) =>
            typeof entry === "string"
              ? !entry.startsWith("constructor")
              : entry.type !== "constructor",
          ),
          ...impl.abi,
        ];
    }
  }
  if (!abi) throw new Error("No verified ABI. Paste the contract ABI.");
  return abi as InterfaceAbi;
}
export function consoleInterface(json: string) {
  return new Interface(JSON.parse(json) as InterfaceAbi);
}
export function functionArguments(fn: FunctionFragment, values: string[]) {
  if (values.length > fn.inputs.length) throw new Error("Too many arguments.");
  return fn.inputs.map((param, i) => {
    const raw = values[i] ?? "";
    if (param.baseType === "array" || param.baseType === "tuple")
      return JSON.parse(raw);
    if (param.type === "bool") {
      if (!["true", "false"].includes(raw))
        throw new Error(`${param.name}: true / false`);
      return raw === "true";
    }
    return raw;
  });
}
export function prepareConsole(
  to: string,
  abi: Interface,
  signature: string,
  values: string[],
  value: string,
): PreparedCall {
  const fn = abi.getFunction(signature);
  if (!fn) throw new Error("Function not found.");
  const amount = BigInt(value || "0");
  if (amount < 0n || (!fn.payable && amount !== 0n))
    throw new Error("This function cannot receive that value.");
  return {
    chainId: NETWORK.chainId,
    to,
    data: abi.encodeFunctionData(fn, functionArguments(fn, values)),
    value: "0x" + amount.toString(16),
    operation: fn.format("sighash"),
  };
}
export async function readConsole(call: PreparedCall, abi: Interface) {
  const raw = await rpc("eth_call", [
    { to: call.to, data: call.data, value: call.value },
    "latest",
  ]);
  return abi.decodeFunctionResult(call.operation, raw).toArray(true);
}
