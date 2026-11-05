import jwt from '@hapi/jwt'

import { mockClientAssertion } from './mock.js'

describe('#mockClientAssertion', () => {
  test('plugin name is client-assertion', () => {
    expect(mockClientAssertion.plugin.name).toBe('client-assertion')
  })

  test('decorates server with clientAssertion', () => {
    const server = { decorate: vi.fn() }

    mockClientAssertion.plugin.register(server)

    expect(server.decorate).toHaveBeenCalledWith(
      'server', 'clientAssertion', expect.any(Object)
    )
  })

  test('getToken returns a signed JWT with correct claims', async () => {
    const server = { decorate: vi.fn() }

    mockClientAssertion.plugin.register(server)

    const provider = server.decorate.mock.calls[0][2]
    const token = await provider.getToken()
    const decoded = jwt.token.decode(token)
    const payload = decoded.decoded.payload

    expect(payload.iss).toBe('d02ee02c-b8da-483d-8a4e-29de7db48b03')
    expect(payload.sub).toBe('d02ee02c-b8da-483d-8a4e-29de7db48b03')
    expect(payload.aud).toBe('http://localhost:8084/land-model-feedback/realms/defra-local')
    expect(payload.jti).toBeDefined()
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })
})
