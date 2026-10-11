// Match the backend creation policy: Unicode scalar values, no normalization,
// and an independent UTF-8 byte limit before expensive password hashing.
export function validNewPassword(password: string): boolean {
  return (
    password.length <= 1024 &&
    !/[\uD800-\uDFFF]/u.test(password) &&
    Array.from(password).length >= 12 &&
    new TextEncoder().encode(password).length <= 1024
  );
}
