import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AbiCoder,
  keccak256,
  Interface,
  ZeroAddress,
  ZeroHash,
  zeroPadValue,
} from "ethers";
import {
  codeCSV,
  codeParams,
  matchesUseCase,
  codeLink,
  emptyCodeFilters,
  filterCodeRecords,
  readCodeFilters,
  verifyCode,
  prepareCodeVerification,
  CODE_SCROLL_ABI,
} from "../lib/code-records";
import {
  schemaHistoryEvents,
  schemaHistoryRequest,
  ATTESTED_TOPIC,
} from "../lib/history";
import { codeHistory, invalidateScanCache } from "../lib/scan-data";
import { CONTRACTS, NETWORK, SCHEMAS, type Attestation } from "../lib/giwa";

const issuer = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
const hash = (n: number) => "0x" + n.toString(16).padStart(64, "0");
function record(
  domain = "test-scope",
  address = issuer,
  time = 1793059200,
): Attestation {
  return {
    uid: hash(1),
    schema: SCHEMAS[3].uid,
    recipient: ZeroAddress,
    attester: address,
    time,
    expirationTime: 0,
    revocationTime: 0,
    revocable: true,
    refUID: ZeroHash,
    data: "0x",
    status: "active",
    fields: [
      { name: "domain", type: "string", value: domain },
      { name: "codeHash", type: "bytes32", value: hash(2) },
    ],
    schemaName: "Verified Code",
    schemaLabel: "코드 인증",
    schemaCurrent: true,
    dojang: true,
    registeredIssuer: true,
    issuerClass: "registered",
    managementRole: false,
    issuerName: "등록 발행자",
    issuerId: hash(3),
  };
}
test("code filters preserve exact domain and separate issuers, status and UTC inclusive dates", () => {
  const start = Date.parse("2026-10-27T00:00:00Z") / 1000;
  const records = [
    record("test-scope", issuer, start),
    record("test-scope", issuer, start + 86399),
    record("test-scope", issuer, start + 86400),
    record("Test-scope", issuer, start),
    record("test-scope", other, start),
    { ...record("test-scope", issuer, start), status: "revoked" as const },
  ];
  const filters = {
    ...emptyCodeFilters,
    domain: "test-scope",
    issuer,
    status: "active",
    from: "2026-10-27",
    to: "2026-10-27",
  };
  assert.deepEqual(filterCodeRecords(records, filters), records.slice(0, 2));
  assert.throws(
    () => filterCodeRecords(records, { ...filters, from: "2026-10-28" }),
    /시작일/,
  );
});
test("shared links round-trip use case and issuer without code hashes; malformed filters are discarded", () => {
  const query = new URLSearchParams(
    codeLink("test-scope & 신청", issuer).slice(1),
  );
  assert.deepEqual(readCodeFilters(query), {
    ...emptyCodeFilters,
    domain: "test-scope & 신청",
    issuer,
  });
  assert.equal(query.has("codeHash"), false);
  assert.deepEqual(
    readCodeFilters(
      new URLSearchParams(
        "attester=bad&status=invalid&from=2026-02-30&to=9999-99-99",
      ),
    ),
    emptyCodeFilters,
  );
});
test("CSV preserves zero recipient and snapshot scope and neutralizes spreadsheet formulas", () => {
  const csv = codeCSV(
    [record('=HYPERLINK("evil")'), record(" \t+1"), record("text,with\nline")],
    { block: 100, checkedAt: "2026-10-27T00:00:00Z", complete: false },
  );
  assert.ok(csv.startsWith("\ufeff"));
  assert.ok(csv.includes('"\'=HYPERLINK(""evil"")"'));
  assert.ok(csv.includes('"\' \t+1"'));
  assert.ok(csv.includes('"text,with\nline"'));
  assert.ok(csv.includes('"' + ZeroAddress + '"'));
  assert.ok(csv.includes('"partial_loaded_pages"'));
});
test("schema history checks the exact indexed position and excludes future blocks, revocations and malformed UIDs", () => {
  const base = {
    topics: [
      ATTESTED_TOPIC,
      zeroPadValue(ZeroAddress, 32),
      zeroPadValue(issuer, 32),
      SCHEMAS[3].uid,
    ],
    data: hash(1),
    block_number: 100,
    transaction_hash: hash(9),
    block_timestamp: "",
  };
  assert.deepEqual(
    schemaHistoryEvents(
      [
        base,
        { ...base, block_number: 101 },
        { ...base, data: "0x" },
        {
          ...base,
          topics: [ATTESTED_TOPIC, SCHEMAS[3].uid, ZeroHash, SCHEMAS[0].uid],
        },
        { ...base, topics: [hash(99), ...base.topics.slice(1)] },
      ],
      SCHEMAS[3].uid,
      100,
    ),
    [base],
  );
  const url = new URL(
    schemaHistoryRequest(SCHEMAS[3].uid, {
      block_number: 100,
      index: 2,
      items_count: 50,
    }),
  );
  assert.equal(url.searchParams.get("topic"), SCHEMAS[3].uid);
  assert.equal(url.searchParams.get("index"), "2");
  assert.throws(() =>
    schemaHistoryRequest(SCHEMAS[3].uid, {
      block_number: -1,
      index: 2,
      items_count: 50,
    }),
  );
});
function verificationRPC(valid = true, current = issuer, uid = hash(4)) {
  const abi = new Interface([
    ...CODE_SCROLL_ABI,
    "function getAttester(bytes32) view returns(address)",
  ]);
  const reads: { method: string; params: unknown[] }[] = [];
  return {
    reads,
    request: async (method: string, params: unknown[]) => {
      reads.push({ method, params });
      if (method === "eth_blockNumber") return "0x64";
      assert.equal(method, "eth_call");
      assert.equal(params[1], "0x64");
      const call = params[0] as { to: string; data: string };
      const decoded = abi.parseTransaction({ data: call.data })!;
      assert.equal(
        call.to,
        decoded.name === "getAttester"
          ? CONTRACTS.DojangAttesterBook
          : CONTRACTS.DojangScroll,
      );
      if (decoded.name !== "getAttester")
        assert.deepEqual(Array.from(decoded.args), [
          hash(2),
          "test-scope",
          hash(3),
        ]);
      return abi.encodeFunctionResult(decoded.name, [
        decoded.name === "getAttester"
          ? current
          : decoded.name === "isVerifiedCode"
            ? valid
            : uid,
      ]);
    },
  };
}
const verificationInput = {
  domain: "test-scope",
  codeHash: hash(2),
  attesterId: hash(3),
  expectedIssuer: issuer,
};
test("verification checks current issuer and Scroll at one block and returns the actual verification UID", async () => {
  const mock = verificationRPC();
  const result = await verifyCode(verificationInput, mock.request);
  assert.equal(result.valid, true);
  assert.equal(result.uid, hash(4));
  assert.equal(result.block, 100);
  assert.equal(mock.reads.length, 4);
});
test("verification distinguishes a negative response from stale registration, malformed input and RPC failures", async () => {
  const negative = verificationRPC(false);
  const result = await verifyCode(verificationInput, negative.request);
  assert.equal(result.valid, false);
  assert.equal(result.uid, null);
  assert.equal(negative.reads.length, 3);
  await assert.rejects(
    verifyCode(verificationInput, verificationRPC(true, other).request),
    /등록이 변경/,
  );
  await assert.rejects(
    verifyCode(
      verificationInput,
      verificationRPC(true, issuer, ZeroHash).request,
    ),
    /UID/,
  );
  await assert.rejects(
    verifyCode({ ...verificationInput, codeHash: "123456" }, async () => {
      throw new Error("must not call");
    }),
    /32바이트/,
  );
  await assert.rejects(
    verifyCode(verificationInput, async () => {
      throw new Error("RPC down");
    }),
    /RPC down/,
  );
});
test("code history pins pagination and expiry to one snapshot and rejects failed hydration instead of undercounting", async () => {
  const original = globalThis.fetch;
  const abi = new Interface([
    "function getSchemaUid(bytes32) view returns(bytes32)",
    "function getAttester(bytes32) view returns(address)",
    "function getSchema(bytes32) view returns((bytes32 uid,address resolver,bool revocable,string schema))",
    "function getAttestation(bytes32) view returns((bytes32 uid,bytes32 schema,uint64 time,uint64 expirationTime,uint64 revocationTime,bytes32 refUID,address recipient,address attester,bool revocable,bytes data))",
  ]);
  let fail = false,
    heads = 0;
  const snapshots: string[] = [];
  globalThis.fetch = (async (input, options) => {
    const url = String(input);
    if (url !== NETWORK.rpc) {
      if (!url.includes(CONTRACTS.EAS))
        return Response.json({ items: [], next_page_params: null });
      const query = new URL(url).searchParams;
      assert.equal(query.get("topic"), SCHEMAS[3].uid);
      const second = query.has("block_number");
      return Response.json({
        items: [
          {
            topics: [
              ATTESTED_TOPIC,
              zeroPadValue(ZeroAddress, 32),
              zeroPadValue(issuer, 32),
              SCHEMAS[3].uid,
            ],
            data: hash(second ? 2 : 1),
            block_number: 90,
            transaction_hash: hash(9),
          },
        ],
        next_page_params: second
          ? null
          : { block_number: 90, index: 1, items_count: 50 },
      });
    }
    const body = JSON.parse(String(options?.body));
    if (!Array.isArray(body)) {
      if (body.method === "eth_blockNumber") {
        heads++;
        return Response.json({ id: body.id, result: "0x64" });
      }
      assert.equal(body.method, "eth_getBlockByNumber");
      assert.equal(body.params[0], "0x64");
      return Response.json({ id: body.id, result: { timestamp: "0x64" } });
    }
    return Response.json(
      body.map((call: any) => {
        snapshots.push(call.params[1]);
        const decoded = abi.parseTransaction({ data: call.params[0].data })!;
        let values: unknown[];
        switch (decoded.name) {
          case "getSchemaUid":
            values = [SCHEMAS.find((s) => s.id === decoded.args[0])!.uid];
            break;
          case "getAttester":
            values = [ZeroAddress];
            break;
          case "getSchema": {
            const s = SCHEMAS.find((s) => s.uid === decoded.args[0])!;
            values = [[s.uid, ZeroAddress, true, s.definition]];
            break;
          }
          case "getAttestation":
            if (fail) return { id: call.id, result: "0x" };
            values = [
              [
                decoded.args[0],
                SCHEMAS[3].uid,
                50,
                150,
                0,
                ZeroHash,
                ZeroAddress,
                issuer,
                true,
                AbiCoder.defaultAbiCoder().encode(
                  ["bytes32", "string"],
                  [hash(2), "test-scope"],
                ),
              ],
            ];
            break;
          default:
            throw new Error(decoded.name);
        }
        return {
          id: call.id,
          result: abi.encodeFunctionResult(decoded.name, values),
        };
      }),
    );
  }) as typeof fetch;
  invalidateScanCache();
  try {
    const first = await codeHistory();
    assert.equal(first.attestations[0].status, "active"); // expired today, valid at the snapshot
    assert.equal(first.attestations[0].recipient, ZeroAddress);
    assert.equal(first.checkedAt, "1970-01-01T00:01:40.000Z");
    const second = await codeHistory(first.next, first.block);
    assert.equal(second.attestations[0].uid, hash(2));
    assert.equal(second.next, null);
    assert.equal(heads, 1);
    assert.ok(snapshots.every((b) => b === "0x64"));
    fail = true;
    await assert.rejects(codeHistory(first.next, first.block), /다시 조회/);
    fail = false;
    assert.equal(
      (await codeHistory(first.next, first.block)).attestations.length,
      1,
    );
  } finally {
    globalThis.fetch = original;
    invalidateScanCache();
  }
});

test("use case discovery supports partial Unicode searches without inventing aliases", () => {
  assert.equal(matchesUseCase("Test-Scope", " SCOPE "), true);
  assert.equal(
    matchesUseCase("테스트 사용처", "테스트".normalize("NFD")),
    true,
  );
  assert.equal(matchesUseCase("Test-Scope", "테스트"), false);
  const records = [
    record("Test-Scope"),
    record("test-scope"),
    record("unrelated"),
  ];
  assert.deepEqual(
    filterCodeRecords(records, { ...emptyCodeFilters, query: "SCOPE" }),
    records.slice(0, 2),
  );
  assert.deepEqual(
    filterCodeRecords(records, { ...emptyCodeFilters, domain: "Test-Scope" }),
    records.slice(0, 1),
  );
  const filters = { ...emptyCodeFilters, query: "테스트 사용처" };
  assert.deepEqual(
    readCodeFilters(new URLSearchParams(codeParams(filters))),
    filters,
  );
});

test("received codes hash exact UTF-8 bytes and only domains follow GIWA ASCII normalization", () => {
  assert.deepEqual(
    prepareCodeVerification("abc", " T EST-Scope 한글 Ä ", "code"),
    {
      codeHash:
        "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
      domain: "test-scope한글Ä",
    },
  );
  assert.equal(
    prepareCodeVerification(" 001A ", "test-scope", "code").codeHash,
    keccak256("0x203030314120"),
  );
  assert.notEqual(
    prepareCodeVerification("é", "x", "code").codeHash,
    prepareCodeVerification("e\u0301", "x", "code").codeHash,
  );
  assert.equal(
    prepareCodeVerification("한", "A\tB", "code").codeHash,
    keccak256("0xed959c"),
  );
  assert.equal(prepareCodeVerification("한", "A\tB", "code").domain, "a\tb");
  assert.throws(() => prepareCodeVerification("", "x", "code"), /입력/);
});
test("public hash mode preserves the onchain domain and never hashes a hash again", () => {
  assert.deepEqual(
    prepareCodeVerification(" " + hash(2) + " ", " Mixed Scope ", "hash"),
    {
      codeHash: hash(2),
      domain: " Mixed Scope ",
    },
  );
  assert.throws(() => prepareCodeVerification("abc", "x", "hash"), /32바이트/);
});
test("received-code verification sends only the prepared hash and domain to Scroll", async () => {
  const raw = "synthetic-private-code";
  const prepared = prepareCodeVerification(raw, "TEST Scope", "code");
  const abi = new Interface([
    ...CODE_SCROLL_ABI,
    "function getAttester(bytes32) view returns(address)",
  ]);
  const sent: unknown[] = [];
  const result = await verifyCode(
    { ...prepared, attesterId: hash(3), expectedIssuer: issuer },
    async (method, params) => {
      sent.push(params);
      if (method === "eth_blockNumber") return "0x64";
      const call = params[0] as { data: string };
      const decoded = abi.parseTransaction({ data: call.data })!;
      if (decoded.name !== "getAttester")
        assert.deepEqual(Array.from(decoded.args), [
          prepared.codeHash,
          "testscope",
          hash(3),
        ]);
      return abi.encodeFunctionResult(decoded.name, [
        decoded.name === "getAttester"
          ? issuer
          : decoded.name === "isVerifiedCode"
            ? true
            : hash(4),
      ]);
    },
  );
  assert.equal(result.valid, true);
  assert.equal(JSON.stringify({ sent, result }).includes(raw), false);
});

test("local issue-date filters include midnight boundaries and keep their timezone in shared links", () => {
  const start = Date.parse("2026-10-27T15:00:00Z") / 1000;
  const records = [-1, 0, 86399, 86400].map((offset) =>
    record("scope", issuer, start + offset),
  );
  const filters = {
    ...emptyCodeFilters,
    from: "2026-10-28",
    to: "2026-10-28",
    timeZone: "Asia/Seoul",
  };
  assert.deepEqual(filterCodeRecords(records, filters), records.slice(1, 3));
  const restored = readCodeFilters(new URLSearchParams(codeParams(filters)));
  assert.deepEqual(restored, filters);
  assert.deepEqual(filterCodeRecords(records, restored), records.slice(1, 3));
  const legacy = readCodeFilters(
    new URLSearchParams("from=2026-10-28&to=2026-10-28"),
  );
  assert.deepEqual(filterCodeRecords(records, legacy), records.slice(2));
  assert.equal(
    readCodeFilters(new URLSearchParams("tz=Not/AZone")).timeZone,
    undefined,
  );
});

test("local issue-date filters include all of both 23-hour and 25-hour days", () => {
  for (const [day, startISO, endISO] of [
    ["2026-03-08", "2026-03-08T05:00:00Z", "2026-03-09T04:00:00Z"],
    ["2026-11-01", "2026-11-01T04:00:00Z", "2026-11-02T05:00:00Z"],
  ]) {
    const start = Date.parse(startISO) / 1000;
    const end = Date.parse(endISO) / 1000;
    const records = [start - 1, start, end - 1, end].map((time) =>
      record("scope", issuer, time),
    );
    assert.deepEqual(
      filterCodeRecords(records, {
        ...emptyCodeFilters,
        from: day,
        to: day,
        timeZone: "America/New_York",
      }),
      records.slice(1, 3),
    );
  }
});
