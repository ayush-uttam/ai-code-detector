/**
 * Validates whether a string is a valid HTTP header value according to RFC 7230
 * (printable US-ASCII and tabs, no control characters, no non-ASCII).
 * Also filters out common placeholder values (like "undefined", "null", or masking bullets).
 */
export function isValidHttpHeaderValue(val: string): boolean {
  if (!val) return false;

  const lower = val.toLowerCase();
  if (
    lower === "" ||
    lower === "undefined" ||
    lower === "null" ||
    val.includes("•")
  ) {
    return false;
  }

  // Check for invalid control characters or non-ASCII characters
  for (let i = 0; i < val.length; i++) {
    const code = val.charCodeAt(i);
    // Allow horizontal tab (9) and space (32) but reject other control characters (< 32) and DEL (127) or non-ASCII (>= 127)
    if ((code < 32 && code !== 9) || code >= 127) {
      return false;
    }
  }
  return true;
}
