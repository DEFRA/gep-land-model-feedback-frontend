import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import Joi from 'joi'
import { config } from '#/config/config.js'
import { logExternalCall } from '../../helpers/logging/logger.js'

const ids = Joi.object({ uploadId: Joi.string().uuid().required(), fileId: Joi.string().uuid().required() })
let client
function s3Client () {
  const endpoint = config.get('evidenceDownload.s3Endpoint')
  client ??= new S3Client(endpoint ? { endpoint, forcePathStyle: true } : {})
  return client
}

/** Read the clean object placed in the configured bucket by CDP Uploader. */
export async function getEvidence (uploadId, fileId) {
  if (ids.validate({ uploadId, fileId }).error) {
    throw new Error('Invalid evidence download IDs')
  }
  return logExternalCall('S3', 'download evidence', () => s3Client().send(new GetObjectCommand({
    Bucket: config.get('uploader.bucket'),
    Key: `evidence/${uploadId}/${fileId}`
  })))
}
