import { vi } from 'vitest'
import process from 'node:process'
import { startServer } from './server/common/helpers/start-server.js'
import { createLogger } from './server/common/helpers/logging/logger.js'

vi.mock('./server/common/helpers/start-server.js', () => ({ startServer: vi.fn() }))
vi.mock('./server/common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn() }))
}))

test('starts the service and reports unhandled rejections with a failing exit code', async () => {
  const on = vi.spyOn(process, 'on').mockReturnValue(process)
  try {
    await import('./index.js')
    expect(startServer).toHaveBeenCalledOnce()
    const handler = on.mock.calls.find(([name]) => name === 'unhandledRejection')[1]
    const error = new Error('unhandled failure')
    const exitCode = process.exitCode
    handler(error)
    expect(process.exitCode).toBe(1)
    process.exitCode = exitCode
    const logger = vi.mocked(createLogger).mock.results[0].value
    expect(logger.info).toHaveBeenCalledWith('Unhandled rejection')
    expect(logger.error).toHaveBeenCalledWith(error)
  } finally {
    on.mockRestore()
  }
})
