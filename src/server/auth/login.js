const loginController = {
  options: {
    auth: 'federated-oidc'
  },
  handler: (_request, h) => h.redirect('/')
}

export { loginController }
