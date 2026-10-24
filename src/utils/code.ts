/**
 * Generates a 6-character unambiguous join code.
 * Excludes: O (looks like 0), I (looks like 1), 0, 1
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateJoinCode(): string {
  let code = '';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (const byte of array) {
    code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}

/** Formats a 6-character code as XXX-XXX (e.g. BOO-482) */
export function formatJoinCode(code: string): string {
  const clean = normalizeJoinCode(code);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}

/** Normalizes a code by stripping hyphens/whitespace and uppercasing */
export function normalizeJoinCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/** Converts 0-indexed option order to A, B, C … Z, AA, AB … */
export function orderToLabel(order: number): string {
  if (order < 26) return String.fromCharCode(65 + order);
  return String.fromCharCode(65 + Math.floor(order / 26) - 1) +
         String.fromCharCode(65 + (order % 26));
}

/** Generates a secure random host token */
export function generateHostToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generates a random document ID */
export function generateId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}
