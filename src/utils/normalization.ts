/** Preserve accents and punctuation: collapse whitespace and case only. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-US");
}
export function newId(): string {
  return crypto.randomUUID();
}
export function now(): string {
  return new Date().toISOString();
}
