export function calculateSettlement(
  totalPoolCents: bigint,
  winnerCount: number,
): {
  commissionCents: bigint;
  distributableCents: bigint;
  payoutEachCents: bigint;
  remainderCents: bigint;
  carryoverCents: bigint;
};
