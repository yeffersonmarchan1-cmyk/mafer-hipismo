export function normalizeCedula(value: string): string | null {
  const compact = value.toUpperCase().replace(/[\s.-]/g, "");
  const normalized = /^\d{5,12}$/.test(compact) ? `V${compact}` : compact;
  return /^[VE]\d{5,12}$/.test(normalized) ? normalized : null;
}

export function normalizePhone(value: string): string | null {
  const phone = value.trim().replace(/[\s()-]/g, "");
  return /^\+?[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
