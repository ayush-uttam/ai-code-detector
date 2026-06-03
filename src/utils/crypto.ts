function xorEncrypt(text: string, key: string): string {
  if (!text) return "";
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(result);
}

function xorDecrypt(encoded: string, key: string): string {
  if (!encoded) return "";
  try {
    const raw = atob(encoded);
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    console.error("XOR Decrypt failed:", e);
    return "";
  }
}

const SECURE_PREFIX = "__secure__:";

/**
 * Secures a key for storage. Always encrypts and prefixes with "__secure__:".
 */
export function secureKey(text: any, key: string): string {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  return SECURE_PREFIX + xorEncrypt(trimmed, key);
}

/**
 * Resolves a key to plain text. If it has the "__secure__:" prefix, decrypts it.
 * Otherwise, returns it as-is (legacy plain-text).
 */
export function resolveKey(stored: any, key: string): string {
  if (!stored || typeof stored !== "string") return "";
  const trimmed = stored.trim();
  if (trimmed.startsWith(SECURE_PREFIX)) {
    return xorDecrypt(trimmed.substring(SECURE_PREFIX.length), key);
  }
  return trimmed;
}
