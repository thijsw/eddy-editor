const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:']

/**
 * Returns a safe href string, or null if the URL is empty or uses a
 * disallowed scheme. Accepts absolute URLs with http/https/mailto/tel,
 * protocol-relative URLs, relative paths, and fragment links.
 *
 * Rejects javascript:, data:, vbscript:, and any string containing control
 * characters — these are the vectors for XSS via anchor hrefs.
 */
export function sanitizeHref(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase() + ':'
    return ALLOWED_SCHEMES.includes(scheme) ? trimmed : null
  }
  // No scheme: relative path, fragment, or protocol-relative URL — all safe.
  return trimmed
}
