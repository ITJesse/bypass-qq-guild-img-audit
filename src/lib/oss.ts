import OSS, { SignatureUrlOptions } from 'ali-oss'
import crypto from 'crypto'
import fileType from 'file-type'
import { ReadStream } from 'fs'
import sharp from 'sharp'

const createClient = () =>
  new OSS({
    accessKeyId: process.env.ALIYUN_OSS_KEY ?? '',
    accessKeySecret: process.env.ALIYUN_OSS_SECRET ?? '',
    bucket: process.env.ALIYUN_OSS_BUCKET,
    region: process.env.ALIYUN_OSS_REGION,
    secure: true,
  })

export const store = createClient()

export const uploadBuf = async (buf: Buffer, pre = ''): Promise<string> => {
  const hash = crypto.createHash('sha1').update(buf).digest('hex')

  const fileKey =
    pre +
    hash.substring(0, 2) +
    '/' +
    hash.substring(2, 4) +
    '/' +
    hash.substring(4)

  try {
    await store.head(fileKey)
    return fileKey
  } catch {}

  const mime = await fileType.fromBuffer(buf)
  await store.put(fileKey, buf, {
    headers: {
      'Content-Type': mime?.mime,
    },
  })
  return fileKey
}

export const getUrl = (fileKey: string) => store.generateObjectUrl(fileKey)

export const signUrl = (
  fileKey: string,
  process?: SignatureUrlOptions['process'],
  expires?: number,
) => {
  const url = store.signatureUrl(fileKey, { process, expires })
  return url
}
