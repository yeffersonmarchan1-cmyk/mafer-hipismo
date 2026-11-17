export function formatBs(amount: string): string {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) {
    throw new Error("El importe en bolívares no tiene un formato válido.");
  }
  const [, sign, integer, fraction = ""] = match;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Bs. ${sign}${grouped},${fraction.padEnd(2, "0")}`;
}

export function formatBsFromCents(cents: bigint): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = cents < 0 ? -cents : cents;
  const whole = absolute / BigInt(100);
  const fraction = (absolute % BigInt(100)).toString().padStart(2, "0");
  return formatBs(`${sign}${whole}.${fraction}`);
}
