import { createServer } from '../../server.js'
import { statusCodes } from '../constants/status-codes.js'
import { setCacheHeaders } from './cache-headers.js'

describe('#cacheHeaders', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should set no-store cache-control on HTML pages', async () => {
    const { headers } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(headers['cache-control']).toBe(
      'no-store, no-cache, must-revalidate'
    )
  })

  test('Should set no-store cache-control on error responses', async () => {
    const { headers, statusCode } = await server.inject({
      method: 'GET',
      url: '/this-page-does-not-exist'
    })

    expect(statusCode).toBe(statusCodes.notFound)
    expect(headers['cache-control']).toBe(
      'no-store, no-cache, must-revalidate'
    )
  })

  test('Should set no-store cache-control on Boom responses', () => {
    const request = {
      path: '/some-page',
      response: {
        isBoom: true,
        output: { headers: {} }
      }
    }

    setCacheHeaders(request, {})

    expect(request.response.output.headers['cache-control']).toBe(
      'no-store, no-cache, must-revalidate'
    )
  })

  test('Should not override existing cache-control on Boom responses', () => {
    const request = {
      path: '/some-page',
      response: {
        isBoom: true,
        output: { headers: { 'cache-control': 'no-cache' } }
      }
    }

    setCacheHeaders(request, {})

    expect(request.response.output.headers['cache-control']).toBe('no-cache')
  })

  test('Should not override cache-control on static assets', async () => {
    const { headers } = await server.inject({
      method: 'GET',
      url: '/public/assets/images/govuk-crest.svg'
    })

    expect(headers['cache-control']).not.toBe(
      'no-store, no-cache, must-revalidate'
    )
  })

  test('Should not override cache-control on favicon', async () => {
    const { headers } = await server.inject({
      method: 'GET',
      url: '/favicon.ico'
    })

    expect(headers['cache-control']).not.toBe(
      'no-store, no-cache, must-revalidate'
    )
  })
})
