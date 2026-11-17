import assert from "node:assert/strict";
import test from "node:test";
import { calculateSettlement } from "../src/lib/settlement-math.mjs";

test("deducts logistics commission and carries the net pool when nobody wins", () => {
  assert.deepEqual(calculateSettlement(10_005n, 0), {
    commissionCents: 1_000n,
    distributableCents: 9_005n,
    payoutEachCents: 0n,
    remainderCents: 0n,
    carryoverCents: 9_005n,
  });
});

test("keeps an indivisible winner remainder for the next race day", () => {
  assert.deepEqual(calculateSettlement(10_000n, 3), {
    commissionCents: 1_000n,
    distributableCents: 9_000n,
    payoutEachCents: 3_000n,
    remainderCents: 0n,
    carryoverCents: 0n,
  });
  assert.deepEqual(calculateSettlement(10_002n, 4), {
    commissionCents: 1_000n,
    distributableCents: 9_002n,
    payoutEachCents: 2_250n,
    remainderCents: 2n,
    carryoverCents: 2n,
  });
});

test("a later jornada charges commission again on the accumulated total", () => {
  const first = calculateSettlement(10_002n, 4);
  const next = calculateSettlement(50_000n + first.carryoverCents, 0);

  assert.equal(first.carryoverCents, 2n);
  assert.equal(next.commissionCents, 5_000n);
  assert.equal(next.carryoverCents, 45_002n);
});

test("rejects negative pools and invalid winner counts", () => {
  assert.throws(() => calculateSettlement(-1n, 0), RangeError);
  assert.throws(() => calculateSettlement(1n, -1), RangeError);
  assert.throws(() => calculateSettlement(1n, 1.5), RangeError);
});
