import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import Joi from 'joi'
import { config } from '#/config/config.js'
import { statusCodes } from '../../constants/status-codes.js'
import { logExternalCall } from '../../helpers/logging/logger.js'

const TIMEOUT = 10_000
const ids = Joi.object({ uploadId: Joi.string().uuid().required(), fileId: Joi.string().uuid().required() })
let client

// Match the Land Model Viewer's S3 client, using LocalStack for local evidence.
function getClient () {
  if (!client) {
    const endpoint = config.get('evidenceDownload.s3Endpoint') || undefined
    const accessKeyId = config.get('evidenceDownload.accessKeyId')
    client = new S3Client({
      region: config.get('evidenceDownload.region'),
      endpoint,
      forcePathStyle: Boolean(endpoint),
      requestHandler: { requestTimeout: TIMEOUT, throwOnRequestTimeout: true },
      credentials: accessKeyId ? { accessKeyId, secretAccessKey: config.get('evidenceDownload.secretAccessKey') } : undefined
    })
  }
  return client
}

function objectInput (uploadId, fileId) {
  if (ids.validate({ uploadId, fileId }).error) {
    throw new Error('Invalid evidence download IDs')
  }
  return { Bucket: config.get('uploader.bucket'), Key: `evidence/${uploadId}/${fileId}` }
}

export function isMissingEvidence (error) {
  return error?.name !== 'NoSuchBucket' &&
    (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === statusCodes.notFound)
}

/** Read the existing clean object. The caller aborts when the browser disconnects. */
export async function getEvidence (uploadId, fileId, signal) {
  const input = objectInput(uploadId, fileId)
  return logExternalCall('S3', 'GetObject', () => getClient().send(new GetObjectCommand(input), { abortSignal: signal }))
}

/** HEAD reads metadata without fetching the file content. */
export async function getEvidenceMetadata (uploadId, fileId, signal) {
  const input = objectInput(uploadId, fileId)
  return logExternalCall('S3', 'HeadObject', () => getClient().send(new HeadObjectCommand(input), { abortSignal: signal }))
}
