/**
 * Money utilities.
 *
 * ALL monetary values in this app are integers in minor units (cents).
 * Never use floats for money. Do every arithmetic operation in integer cents
 * and only convert to a display string at the very edge (UI).
 */

export const CURRENCY = "USD";
export const CURRENCY_SYMBOL = "$";

/** Parse a user-entered amount string (e.g. "12.34", "$1,200") into integer cents. */
export function parseMoney(input: string | number): number {
  if (typeof input === "number") {
    return Math.round(input * 100);
  }
  const cleaned = input.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return 0;
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

/** Format integer cents as a currency string, e.g. 123456 -> "$1,234.56". */
export function formatMoney(cents: number, opts?: { showSymbol?: boolean }): string {
  const showSymbol = opts?.showSymbol ?? true;
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const formatted = `${dollars.toLocaleString("en-US")}.${remainder
    .toString()
    .padStart(2, "0")}`;
  const sign = negative ? "-" : "";
  return `${sign}${showSymbol ? CURRENCY_SYMBOL : ""}${formatted}`;
}

/** Convert integer cents to a plain number of dollars (for charts only — not for math). */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Margin % = profit / revenue * 100. Returns null when revenue is 0
 * (undefined margin) so callers can render an em-dash.
 */
export function marginPct(profitCents: number, revenueCents: number): number | null {
  if (revenueCents === 0) return null;
  return (profitCents / revenueCents) * 100;
}

/**
 * Markup % = profit / cost * 100. Returns null when cost is 0.
 */
export function markupPct(profitCents: number, costCents: number): number | null {
  if (costCents === 0) return null;
  return (profitCents / costCents) * 100;
}

/** Format a percentage value (or null) for display, e.g. 42.5 -> "42.5%". */
export function formatPct(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/**
 * Compute a line/sale's gross profit and margin from integer-cent inputs.
 * Quantities may be fractional (kg/m/L); revenue/cogs are rounded to whole cents.
 */
export function computeLine(qty: number, unitSalePrice: number, unitCost: number) {
  const lineRevenue = Math.round(qty * unitSalePrice);
  const lineCogs = Math.round(qty * unitCost);
  const lineProfit = lineRevenue - lineCogs;
  return { lineRevenue, lineCogs, lineProfit };
}
