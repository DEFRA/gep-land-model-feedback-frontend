import { vi } from 'vitest'
import { getLocalAuthBypassHost } from './local-auth.js'

const values = vi.hoisted(() => ({ 'auth.required': true, isDevelopment: true, appBaseUrl: 'http://localhost:3004' }))
vi.mock('#/config/config.js', () => ({ config: { get: (key) => values[key] } }))

beforeEach(() => Object.assign(values, { 'auth.required': true, isDevelopment: true, appBaseUrl: 'http://localhost:3004' }))

test('requires explicit opt-out and development mode', () => {
  expect(getLocalAuthBypassHost()).toBeNull()
  values['auth.required'] = false
  values.isDevelopment = false
  expect(getLocalAuthBypassHost()).toBeNull()
})

test.each([
  ['http://localhost:3004', '127.0.0.1'],
  ['http://127.0.0.1:3004', '127.0.0.1'],
  ['http://[::1]:3004', '::1'],
  ['https://localhost.example.com', null],
  ['https://example.com', null],
  ['not a URL', null]
])('restricts local bypass to loopback URLs: %s', (url, expected) => {
  values['auth.required'] = false
  values.appBaseUrl = url
  expect(getLocalAuthBypassHost()).toBe(expected)
})
