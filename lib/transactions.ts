import {
  BrowserProvider,
  Interface,
  getAddress,
  type Eip1193Provider,
  type TransactionReceipt,
} from "ethers";
import { NETWORK, CONTRACTS } from "./giwa";
import { injected } from "./wallet";
import { invalidateScanCache } from "./scan-data";
import type { PreparedCall } from "./workspace";
const events = new Interface([
  "event Attested(address indexed recipient,address indexed attester,bytes32 uid,bytes32 indexed schemaUID)",
  "event Registered(bytes32 indexed uid,address indexed registerer,(bytes32 uid,address resolver,bool revocable,string schema) schema)",
]);
export type TransactionResult = {
  hash: string;
  status: "pending" | "confirmed" | "failed";
  block?: number;
  uids: string[];
  error?: string;
};
export function explainError(error: unknown) {
  const e = error as {
    shortMessage?: string;
    reason?: string;
    message?: string;
    info?: { error?: { message?: string } };
  };
  return (
    e.reason ||
    e.info?.error?.message ||
    e.shortMessage ||
    e.message ||
    String(error)
  );
}
export async function walletState(source: Eip1193Provider = injected()) {
  const provider = new BrowserProvider(source);
  const accounts = (await provider.send("eth_accounts", [])) as string[];
  const chain = Number(BigInt(await provider.send("eth_chainId", [])));
  return {
    provider,
    address: accounts[0] ? getAddress(accounts[0]) : "",
    chain,
  };
}
function decodeReceipt(receipt: TransactionReceipt): TransactionResult {
  if (receipt.status === 1) invalidateScanCache();
  const uids: string[] = [];
  for (const log of receipt.logs) {
    if (
      ![CONTRACTS.EAS, CONTRACTS.SchemaRegistry].some(
        (a) => a.toLowerCase() === log.address.toLowerCase(),
      )
    )
      continue;
    try {
      const event = events.parseLog(log);
      if (event?.args.uid) uids.push(String(event.args.uid));
    } catch {}
  }
  return {
    hash: receipt.hash,
    status: receipt.status === 1 ? "confirmed" : "failed",
    block: receipt.blockNumber,
    uids,
  };
}
export async function executeCall(
  call: PreparedCall,
  reviewedAddress: string,
  onSubmitted: (result: TransactionResult) => void,
  source: Eip1193Provider = injected(),
) {
  const { provider, address, chain } = await walletState(source);
  if (chain !== NETWORK.chainId || call.chainId !== chain)
    throw new Error("Switch the wallet to GIWA Sepolia before sending.");
  if (!address || address !== getAddress(reviewedAddress))
    throw new Error(
      "Wallet account changed. Connect and review the call again.",
    );
  if ((await provider.getCode(call.to)) === "0x")
    throw new Error("No contract code at the selected target.");
  const tx = {
    to: getAddress(call.to),
    data: call.data,
    value: BigInt(call.value),
    from: address,
  };
  await provider.call(tx);
  const gas = await provider.estimateGas(tx);
  // Re-check after preflight: chain/account events must invalidate old reviews.
  const fresh = await walletState(source);
  if (fresh.chain !== chain || fresh.address !== address)
    throw new Error("Wallet account or network changed during review.");
  const signer = await provider.getSigner(address);
  const hash = await signer.sendUncheckedTransaction({
    ...tx,
    gasLimit: (gas * 120n) / 100n,
  });
  onSubmitted({ hash, status: "pending", uids: [] });
  try {
    const response = await provider.getTransaction(hash);
    const receipt = response
      ? await response.wait(1, 120_000)
      : await provider.waitForTransaction(hash, 1, 120_000);
    if (!receipt) throw new Error("Receipt unavailable.");
    return decodeReceipt(receipt);
  } catch (error) {
    const e = error as {
      code?: string;
      cancelled?: boolean;
      receipt?: TransactionReceipt;
      replacement?: { hash: string };
    };
    if (e.code === "TRANSACTION_REPLACED" && e.cancelled)
      return {
        hash: e.replacement?.hash || hash,
        status: "failed" as const,
        uids: [],
        error: "Transaction cancelled by replacement.",
      };
    if (e.code === "TRANSACTION_REPLACED" && e.receipt && !e.cancelled)
      return decodeReceipt(e.receipt);
    if (e.receipt)
      return { ...decodeReceipt(e.receipt), error: explainError(error) };
    return {
      hash: e.replacement?.hash || hash,
      status: "pending" as const,
      uids: [],
      error: explainError(error),
    };
  }
}
export async function refreshReceipt(hash: string) {
  const { provider, chain } = await walletState();
  if (chain !== NETWORK.chainId)
    throw new Error("Switch the wallet to GIWA Sepolia before sending.");
  const receipt = await provider.getTransactionReceipt(hash);
  return receipt
    ? decodeReceipt(receipt)
    : { hash, status: "pending" as const, uids: [] };
}
