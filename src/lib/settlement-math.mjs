export function calculateSettlement(totalPoolCents, winnerCount) {
  if (totalPoolCents < 0n) {
    throw new RangeError("The pool cannot be negative.");
  }
  if (!Number.isSafeInteger(winnerCount) || winnerCount < 0) {
    throw new RangeError("Winner count must be a non-negative safe integer.");
  }

  const commissionCents = totalPoolCents / 10n;
  const distributableCents = totalPoolCents - commissionCents;
  const payoutEachCents =
    winnerCount === 0 ? 0n : distributableCents / BigInt(winnerCount);
  const remainderCents =
    winnerCount === 0 ? 0n : distributableCents % BigInt(winnerCount);

  return {
    commissionCents,
    distributableCents,
    payoutEachCents,
    remainderCents,
    carryoverCents:
      winnerCount === 0 ? distributableCents : remainderCents,
  };
}
