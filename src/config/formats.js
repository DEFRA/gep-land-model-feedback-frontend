export function registerConfigFormats (convict) {
  convict.addFormat({
    name: 'positive-megabytes',
    validate (value) {
      if (value * 1000000 < 1 || !Number.isSafeInteger(Math.round(value * 1000000))) throw new Error('Use a positive number of megabytes representing at least one byte')
    },
    coerce: Number
  })
  convict.addFormat({
    name: 'mime-type-list',
    validate (value) {
      if (!Array.isArray(value) || value.some(type => typeof type !== 'string' || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(type))) {
        throw new Error('Use a comma-separated list of MIME types, or leave empty for all types')
      }
    },
    coerce (value) {
      if (typeof value !== 'string') return value
      return value.trim() ? value.split(',').map(type => type.trim().toLowerCase()) : []
    }
  })

  convict.addFormat({
    name: 'optional-uuid',
    validate (value) {
      if (value !== '' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error('Use a template UUID or leave empty')
      }
    }
  })
  convict.addFormat({
    name: 'email-subject',
    validate (value) {
      if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value) || value.length > 200) {
        throw new Error('Use a non-blank, single-line email title of at most 200 characters')
      }
    }
  })
  convict.addFormat({
    name: 'http-origin-or-empty',
    validate (value) {
      if (value === '') return
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
        throw new Error('Use an HTTP(S) origin or an empty value')
      }
    }
  })
}
