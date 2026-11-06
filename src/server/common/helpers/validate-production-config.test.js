import { validateProductionConfig } from './validate-production-config.js'

const valid = {
  isProduction: true,
  isTest: false,
  'session.cookie.password': 'a-unique-deployment-secret-with-at-least-32-characters',
  'session.cookie.secure': true,
  'cognito.enabled': true,
  'cognito.identityPoolId': 'eu-west-2:configured-pool',
  appBaseUrl: 'https://feedback.example.com',
  'oidc.wellKnownConfigurationUrl': 'https://identity.example.com/.well-known/openid-configuration'
}
const settings = overrides => ({ get: key => ({ ...valid, ...overrides })[key] })

test('accepts secure production settings and permits local development defaults', () => {
  expect(() => validateProductionConfig(settings({}))).not.toThrow()
  expect(() => validateProductionConfig(settings({ isProduction: false, 'session.cookie.password': '' }))).not.toThrow()
  expect(() => validateProductionConfig(settings({ isTest: true, 'session.cookie.password': '' }))).not.toThrow()
})

test.each([
  ['session.cookie.password', undefined],
  ['session.cookie.password', 'short'],
  ['session.cookie.password', ' '.repeat(32)],
  ['session.cookie.password', 'the-password-must-be-at-least-32-characters-long'],
  ['session.cookie.secure', false],
  ['cognito.enabled', false],
  ['cognito.identityPoolId', '']
])('rejects unsafe production setting %s', (key, value) => {
  expect(() => validateProductionConfig(settings({ [key]: value }))).toThrow('Production requires')
})

test.each(['appBaseUrl', 'oidc.wellKnownConfigurationUrl'])('requires trusted HTTPS for %s', key => {
  for (const value of ['invalid', 'http://localhost:8084', 'https://user:password@example.com', 'https://example.com/#fragment']) {
    expect(() => validateProductionConfig(settings({ [key]: value }))).toThrow('Production requires')
  }
})
