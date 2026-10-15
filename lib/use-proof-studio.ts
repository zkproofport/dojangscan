import { checkMockKycAttestation } from "./mock-kyc";
import { useEffect, useRef, useState } from "react";
import { Wallet, hexlify, randomBytes } from "ethers";
import type { ProofportSDK, RelayProofResult } from "@zkproofport-app/sdk";
import {
  checkPlaygroundAttestation,
  type PlaygroundResult,
} from "./playground";
import {
  STUDIO_CIRCUIT,
  STUDIO_RELAY,
  STUDIO_PROFILES,
  type StudioCircuit,
  STUDIO_WAIT_MS,
  practiceAction,
  prepareStudioProof,
  verifyStudioProof,
  type StudioProof,
} from "./proof-studio";

type Phase =
  | "idle"
  | "checking"
  | "checked"
  | "requesting"
  | "waiting"
  | "received"
  | "verifying"
  | "verified"
  | "ended"
  | "error";

function bounded<T>(work: Promise<T>, ms = 25_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            "응답이 늦어지고 있습니다. 연결을 확인한 뒤 다시 시도해 주세요.",
          ),
        ),
      ms,
    );
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export function useProofStudio(
  initialAddress = "",
  circuit: StudioCircuit = STUDIO_CIRCUIT,
) {
  const checkAttestation =
    circuit === "giwa_attestation"
      ? checkMockKycAttestation
      : checkPlaygroundAttestation;
  const [address, setAddress] = useState(initialAddress);
  const [record, setRecord] = useState<PlaygroundResult | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [qr, setQr] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [proof, setProof] = useState<StudioProof | null>(null);
  const version = useRef(0);
  const lock = useRef(false);
  const sdk = useRef<ProofportSDK | null>(null);
  useEffect(
    () => () => {
      version.current++;
      sdk.current?.disconnect();
    },
    [],
  );

  function reset(nextAddress = address) {
    version.current++;
    lock.current = false;
    sdk.current?.disconnect();
    sdk.current = null;
    setAddress(nextAddress);
    setRecord(null);
    setProof(null);
    setQr("");
    setDeepLink("");
    setError("");
    setNotice("");
    setPhase("idle");
  }

  async function check() {
    if (lock.current) return;
    lock.current = true;
    const current = ++version.current;
    setError("");
    setNotice("");
    setRecord(null);
    setProof(null);
    setPhase("checking");
    try {
      const found = await bounded(checkAttestation(address), 60_000);
      if (current !== version.current) return;
      setRecord(found);
      setAddress(found.address);
      setPhase("checked");
    } catch (e) {
      if (current === version.current) {
        setError((e as Error).message);
        setPhase("error");
      }
    } finally {
      if (current === version.current) lock.current = false;
    }
  }

  async function request() {
    if (lock.current || record?.status !== "confirmed") return;
    lock.current = true;
    const current = ++version.current;
    const wallet = record.address;
    setError("");
    setNotice("");
    setProof(null);
    setPhase("requesting");
    let client: ProofportSDK | undefined;
    try {
      // A prior scan is a learning checkpoint, never a permanent eligibility claim.
      const latest = await bounded(checkAttestation(wallet), 60_000);
      if (current !== version.current) return;
      setRecord(latest);
      if (latest.status !== "confirmed") {
        setPhase("checked");
        return;
      }
      const { ProofportSDK } = await import("@zkproofport-app/sdk");
      if (current !== version.current) return;
      client = new ProofportSDK({ relayUrl: STUDIO_RELAY });
      client.setSigner(Wallet.createRandom()); // Relay authentication, not the user's faucet wallet.
      sdk.current = client;
      const action = practiceAction(hexlify(randomBytes(32)), circuit);
      const pending = await bounded(
        client.createRelayRequest(
          circuit,
          { scope: STUDIO_PROFILES[circuit].scope, action },
          {
            dappName: "Dojangscan Proof Studio",
            dappIcon: "https://dojangscan.com/brand/zkproofport.png",
            message:
              "Dojangscan 실습 / Practice: sign with the wallet whose test attestation you checked. No token transfer.",
          },
        ),
      );
      if (current !== version.current) return;
      if (!pending.requestId || !pending.deepLink.startsWith("zkproofport://"))
        throw new Error("앱으로 보낼 증명 요청을 만들지 못했습니다.");
      const image = await client.generateQRCode(pending.deepLink, {
        width: 480,
      });
      if (current !== version.current) return;
      setQr(image);
      setDeepLink(pending.deepLink);
      setPhase("waiting");
      const deadline = Date.now() + STUDIO_WAIT_MS;
      let result: RelayProofResult | undefined;
      while (current === version.current && Date.now() < deadline) {
        const update = await bounded(
          client.pollResult(pending.requestId),
          Math.max(1, Math.min(25_000, deadline - Date.now())),
        );
        if (update.status !== "pending" && update.status !== "generating") {
          result = update;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (current !== version.current) return;
      setQr("");
      setDeepLink("");
      if (
        !result ||
        result.status === "expired" ||
        result.status === "cancelled"
      ) {
        setNotice(
          result?.status === "cancelled"
            ? "앱에서 요청을 취소했습니다. 준비되면 다시 시작하세요."
            : "요청 시간이 지났습니다. 앱을 준비한 뒤 새 QR을 만들어 주세요.",
        );
        setPhase("ended");
        return;
      }
      if (result.status !== "completed")
        throw new Error(
          result.error ||
            "앱에서 증명을 완료하지 못했습니다. 발급에 사용한 지갑을 선택한 뒤 다시 시도해 주세요.",
        );
      setProof(
        prepareStudioProof(result, pending.requestId, wallet, action, circuit),
      );
      setPhase("received");
    } catch (e) {
      if (current === version.current) {
        setQr("");
        setDeepLink("");
        setError(
          e instanceof TypeError
            ? "증명 연결에 실패했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요."
            : (e as Error).message,
        );
        setPhase("error");
      }
    } finally {
      client?.disconnect();
      if (current === version.current) lock.current = false;
    }
  }

  async function verify() {
    if (lock.current || !proof) return;
    lock.current = true;
    const current = ++version.current;
    setError("");
    setPhase("verifying");
    try {
      const valid = await bounded(verifyStudioProof(proof));
      if (current !== version.current) return;
      if (!valid)
        throw new Error(
          "증명이 검증을 통과하지 못했습니다. 새로 생성해 주세요.",
        );
      setPhase("verified");
    } catch (e) {
      if (current === version.current) {
        setError((e as Error).message);
        setPhase("received");
      }
    } finally {
      if (current === version.current) lock.current = false;
    }
  }
  return {
    address,
    record,
    phase,
    error,
    notice,
    qr,
    deepLink,
    proof,
    reset,
    check,
    request,
    verify,
    busy: ["checking", "requesting", "waiting", "verifying"].includes(phase),
  };
}
