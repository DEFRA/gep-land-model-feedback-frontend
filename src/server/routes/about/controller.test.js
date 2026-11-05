import { mockAuthCredentials } from '#/server/common/test-helpers/auth.js'
import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#aboutController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      auth: mockAuthCredentials,
      method: 'GET',
      url: '/about'
    })

    expect(result).toEqual(expect.stringContaining('About |'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})
