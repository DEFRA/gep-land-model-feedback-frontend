import { getSafeRedirect } from './get-safe-redirect.js'

describe('#getSafeRedirect', () => {
  test('should return / for null', () => {
    expect(getSafeRedirect(null)).toBe('/')
  })

  test('should return / for undefined', () => {
    expect(getSafeRedirect(undefined)).toBe('/')
  })

  test('should return / for empty string', () => {
    expect(getSafeRedirect('')).toBe('/')
  })

  test('should return / for non-string input', () => {
    expect(getSafeRedirect(123)).toBe('/')
  })

  test('should allow a valid relative path', () => {
    expect(getSafeRedirect('/about')).toBe('/about')
  })

  test('should allow a relative path with query string', () => {
    expect(getSafeRedirect('/search?q=test')).toBe('/search?q=test')
  })

  test('should allow nested relative paths', () => {
    expect(getSafeRedirect('/foo/bar/baz')).toBe('/foo/bar/baz')
  })

  test('should return / for absolute URL with https', () => {
    expect(getSafeRedirect('https://evil.com')).toBe('/')
  })

  test('should return / for absolute URL with http', () => {
    expect(getSafeRedirect('http://evil.com/path')).toBe('/')
  })

  test('should return / for protocol-relative URL', () => {
    expect(getSafeRedirect('//evil.com')).toBe('/')
  })

  test('should return / for protocol-relative URL with path', () => {
    expect(getSafeRedirect('//evil.com/path')).toBe('/')
  })

  test('should return / for encoded double-slash', () => {
    expect(getSafeRedirect('%2f%2fevil.com')).toBe('/%2f%2fevil.com')
  })

  test('should return / for path traversal attempt', () => {
    expect(getSafeRedirect('/../../../etc/passwd')).toBe('/etc/passwd')
  })

  test('should return / for javascript protocol', () => {
    expect(getSafeRedirect('javascript:alert(1)')).toBe('/')
  })

  test('should return / for data protocol', () => {
    expect(getSafeRedirect('data:text/html,<script>alert(1)</script>')).toBe('/')
  })

  test('should return / as-is', () => {
    expect(getSafeRedirect('/')).toBe('/')
  })
})
