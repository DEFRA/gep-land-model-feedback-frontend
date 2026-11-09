import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { config } from '#/config/config.js'
import { getEvidence } from './client.js'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function () { this.send = send }),
  GetObjectCommand: vi.fn(function (input) { this.input = input })
}))
const uploadId = '11111111-1111-4111-8111-111111111111'
const fileId = '22222222-2222-4222-8222-222222222222'
beforeEach(() => { send.mockReset() })

test('reads the existing uploader object in the configured clean bucket without copying', async () => {
  const result = { Body: 'stream', Metadata: { filename: 'original.pdf' } }
  send.mockResolvedValue(result)
  expect(await getEvidence(uploadId, fileId)).toBe(result)
  expect(S3Client).toHaveBeenCalled()
  expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: config.get('uploader.bucket'), Key: `evidence/${uploadId}/${fileId}` })
})

test.each([['../private', fileId], [uploadId, 'private/key'], [undefined, fileId]])('rejects arbitrary keys before contacting S3', async (upload, file) => {
  await expect(getEvidence(upload, file)).rejects.toThrow('Invalid evidence download IDs')
  expect(send).not.toHaveBeenCalled()
})
