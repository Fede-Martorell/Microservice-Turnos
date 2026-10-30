export function currencyDigits(currency: string) {
  if (!Intl.supportedValuesOf("currency").includes(currency)) return null;
  return (
    new Intl.NumberFormat("es", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

export function parseMoney(value: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  const normalized = value.trim().replace(",", ".");
  if (digits === null || !/^\d{1,10}(?:\.\d{1,3})?$/.test(normalized))
    return null;
  const [whole = "", fraction = ""] = normalized.split(".");
  if (fraction.length > digits) return null;
  const amount =
    Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0"));
  return Number.isSafeInteger(amount) && amount <= 1000000000 ? amount : null;
}
export function priceInput(amount: number, currency: string) {
  const digits = currencyDigits(currency) ?? 2;
  return (amount / 10 ** digits).toFixed(digits);
}
export function formatMoney(amount: number, currency: string) {
  const digits = currencyDigits(currency) ?? 2;
  return new Intl.NumberFormat("es-AR", { style: "currency", currency }).format(
    amount / 10 ** digits,
  );
}
