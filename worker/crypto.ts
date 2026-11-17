const PBKDF2_ITERATIONS = 100_000;
const PASSWORD_MIN_LENGTH = 8;
const COMMON_PASSWORDS = new Set(
  '12345678 123456789 1234567890 87654321 11111111 00000000 12341234 11223344 password password1 password123 passw0rd qwertyui qwerty123 qwertyuiop kalima123 kalima2026'.split(' '),
);

const toHex = (buffer: ArrayBuffer | Uint8Array): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const randomHex = (bytes: number): string => toHex(crypto.getRandomValues(new Uint8Array(bytes)));

export const sha256Hex = async (text: string): Promise<string> =>
  toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

export const hashPassword = async (password: string, saltHex: string): Promise<string> => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g)!.map((pair) => parseInt(pair, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return toHex(bits);
};

/** Bandingkan dua string hex dengan waktu konstan. */
const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

export const verifyPassword = async (password: string, saltHex: string, expectedHash: string): Promise<boolean> =>
  constantTimeEqual(await hashPassword(password, saltHex), expectedHash);

/** Kembalikan alasan penolakan (Bahasa Indonesia), atau null bila kata sandi boleh dipakai. */
export const isAcceptablePassword = (password: unknown): string | null => {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'Kata sandi terlalu umum dan mudah ditebak. Pilih yang lain.';
  }
  return null;
};
