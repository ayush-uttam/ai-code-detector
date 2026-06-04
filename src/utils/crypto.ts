// Legacy XOR Obfuscation (for backward compatibility support)
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

// AES-GCM standard encryption/decryption using Web Crypto API
async function deriveKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKey = await crypto.subtle.digest("SHA-256", enc.encode(password));
  return await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

async function aesGcmEncrypt(text: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Safe cross-browser binary to base64
  let binary = "";
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

async function aesGcmDecrypt(encoded: string, secret: string): Promise<string> {
  try {
    const key = await deriveKey(secret);
    const binary = atob(encoded);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }
    
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const dec = new TextDecoder();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return dec.decode(decrypted);
  } catch (err) {
    console.error("AES-GCM Decrypt failed:", err);
    return "";
  }
}

const XOR_PREFIX = "__secure__:";
const AES_PREFIX = "__secure_aes_gcm__:";

/**
 * Secures a key for storage using AES-GCM.
 */
export async function secureKey(text: any, key: string): Promise<string> {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();
  const encrypted = await aesGcmEncrypt(trimmed, key);
  return AES_PREFIX + encrypted;
}

/**
 * Resolves a key to plain text. Detects encryption format and handles fallback.
 */
export async function resolveKey(stored: any, key: string): Promise<string> {
  if (!stored || typeof stored !== "string") return "";
  const trimmed = stored.trim();
  if (trimmed.startsWith(AES_PREFIX)) {
    return await aesGcmDecrypt(trimmed.substring(AES_PREFIX.length), key);
  }
  if (trimmed.startsWith(XOR_PREFIX)) {
    return xorDecrypt(trimmed.substring(XOR_PREFIX.length), key);
  }
  return trimmed;
}
