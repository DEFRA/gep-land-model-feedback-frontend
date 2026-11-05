/**
 * Validates and returns a safe redirect URL.
 * @param {unknown} url - The redirect URL to validate
 * @returns {string} Safe relative path, or '/' if invalid
 */
export function getSafeRedirect (url) {
  if (!url || typeof url !== 'string') {
    return '/'
  }

  try {
    const parsed = new URL(url, 'http://localhost')
    if (parsed.origin !== 'http://localhost') {
      // Origin mismatch - url resolves to an external host
      return '/'
    }

    // Dot segments can normalise to //host, e.g. /.//evil.com
    if (parsed.pathname.startsWith('//')) {
      return '/'
    }

    return parsed.pathname + parsed.search
  } catch {
    return '/'
  }
}
