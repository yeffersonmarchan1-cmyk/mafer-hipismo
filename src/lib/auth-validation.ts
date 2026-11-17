export function normalizeCedula(value: string): string | null {
  const compact = value.toUpperCase().replace(/[\s.-]/g, "");
  const normalized = /^\d{5,12}$/.test(compact) ? `V${compact}` : compact;
  return /^[VE]\d{5,12}$/.test(normalized) ? normalized : null;
}

export function normalizePhone(value: string): string | null {
  const phone = value.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(phone)) return null;

  const nationalNumber =
    phone.startsWith("+58")
      ? phone.slice(3)
      : phone.startsWith("58") && phone.length === 12
        ? phone.slice(2)
        : phone.startsWith("0") && phone.length === 11
          ? phone.slice(1)
          : phone.length === 10
            ? phone
            : "";

  return /^[24]\d{9}$/.test(nationalNumber) ? `+58${nationalNumber}` : null;
}

export function formatVenezuelanPhone(value: string): string {
  const normalized = normalizePhone(value);
  if (!normalized) return value;
  const nationalNumber = normalized.slice(3);
  return `0${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
}
