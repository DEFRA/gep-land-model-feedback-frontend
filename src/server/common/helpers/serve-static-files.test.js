import { createServer } from '../../server.js'
import { statusCodes } from '../constants/status-codes.js'

describe('#serveStaticFiles', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should serve favicon as expected', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/favicon.ico'
    })

    expect(statusCode).toBe(statusCodes.noContent)
  })

  test('Should serve assets as expected', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/public/assets/images/govuk-crest.svg'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })
})
