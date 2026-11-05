import { loginController } from './login.js'
import { logoutController } from './logout.js'
import { authCallbackController } from './callback.js'

const auth = {
  plugin: {
    name: 'auth',
    register: (server) => {
      server.route([
        {
          method: 'GET',
          path: '/auth/login',
          ...loginController
        },
        {
          method: 'GET',
          path: '/auth/logout',
          ...logoutController
        },
        {
          method: ['GET', 'POST'],
          path: '/auth/callback',
          ...authCallbackController
        }
      ])
    }
  }
}

export { auth }
