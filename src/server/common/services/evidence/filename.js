import Joi from 'joi'

const uuidSchema = Joi.string().uuid().required()
const HEX_RADIX = 16

export function evidenceDownloadPath (file) {
  if (uuidSchema.validate(file.uploadId).error || uuidSchema.validate(file.fileId).error) {
    throw new Error('Invalid evidence download IDs')
  }
  return `/evidence/download/${file.uploadId}/${file.fileId}`
}

/** Read the original filename metadata written by CDP Uploader. */
export function originalFilename (metadata = {}) {
  const filename = metadata.encodedfilename ? decodeMimeWords(metadata.encodedfilename) : metadata.filename
  if (typeof filename !== 'string' || !filename.trim() || /[/\\]|\p{Cc}/u.test(filename)) {
    throw new Error('Invalid evidence filename metadata')
  }
  return filename
}

// CDP Uploader encodes non-ASCII names as RFC 2047 encoded words.
function decodeMimeWords (value) {
  return value.replace(/\?=\s+(?==\?)/g, '?=').replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_word, charset, encoding, text) => {
    let bytes
    if (encoding.toLowerCase() === 'b') {
      bytes = Buffer.from(text, 'base64')
    } else {
      const decoded = text.replace(/_/g, ' ').replace(/=([0-9a-f]{2})/gi, (_hex, hex) => String.fromCharCode(parseInt(hex, HEX_RADIX)))
      bytes = Buffer.from(decoded, 'latin1')
    }
    return new TextDecoder(charset, { fatal: true }).decode(bytes)
  })
}

export function attachmentDisposition (filename) {
  const fallback = filename.replace(/[^a-zA-Z0-9._ -]/g, '_')
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(HEX_RADIX).toUpperCase()}`)
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}
