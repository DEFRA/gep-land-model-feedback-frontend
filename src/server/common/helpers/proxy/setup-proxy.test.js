import { ProxyAgent, setGlobalDispatcher } from 'undici'
import { bootstrap } from 'global-agent'

import { setupProxy } from './setup-proxy.js'
import { config } from '../../../../config/config.js'

vi.mock('undici', () => ({
  ProxyAgent: vi.fn(function (url) { this.url = url }),
  setGlobalDispatcher: vi.fn()
}))
vi.mock('global-agent', () => ({ bootstrap: vi.fn() }))
vi.mock('../../../../config/config.js', () => ({ config: { get: vi.fn() } }))
vi.mock('../logging/logger.js', () => ({ createLogger: () => ({ info: vi.fn() }) }))

afterEach(() => vi.unstubAllGlobals())

test('leaves HTTP clients unchanged when no proxy is configured', () => {
  config.get.mockReturnValue(null)

  setupProxy()

  expect(setGlobalDispatcher).not.toHaveBeenCalled()
  expect(bootstrap).not.toHaveBeenCalled()
})

test('configures both HTTP stacks with the configured proxy', () => {
  const proxyUrl = 'http://localhost:8080'
  config.get.mockReturnValue(proxyUrl)
  vi.stubGlobal('GLOBAL_AGENT', {})

  setupProxy()

  expect(config.get).toHaveBeenCalledWith('httpProxy')
  expect(ProxyAgent).toHaveBeenCalledWith(proxyUrl)
  expect(setGlobalDispatcher).toHaveBeenCalledWith(expect.any(ProxyAgent))
  expect(bootstrap).toHaveBeenCalledOnce()
  expect(globalThis.GLOBAL_AGENT.HTTP_PROXY).toBe(proxyUrl)
})
