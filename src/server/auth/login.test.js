import { loginController } from './login.js'

describe('#loginController', () => {
  test('Should use federated-oidc auth', () => {
    expect(loginController.options.auth).toBe('federated-oidc')
  })

  test('Should redirect to /', () => {
    const h = { redirect: vi.fn() }
    loginController.handler({}, h)
    expect(h.redirect).toHaveBeenCalledWith('/')
  })
})
