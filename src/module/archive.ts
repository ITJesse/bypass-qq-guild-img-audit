import axios from 'axios'
import bs58 from 'bs58'

import { REDIS_ARCHIVER_MESSAGE_QUEUE, REDIS_SHORTEN_URL_HSET_KEY } from '@/consts'
import { http } from '@/lib/http'
import { getUrl, uploadBuf } from '@/lib/oss'
import { redisArchiveClient, redisWorkerClient } from '@/lib/redis'
import { ImageMessage } from '@/types'

const getTask = async () => {
  const redis = await redisArchiveClient.getShared()
  const res = await redis.blPop(REDIS_ARCHIVER_MESSAGE_QUEUE, 60)
  if (!res) return null
  const { element: messageData } = res
  return JSON.parse(messageData) as ImageMessage
}

const archive = async (imageUrl: string): Promise<[string, string]> => {
  const redis = await redisArchiveClient.getShared()
  console.log(`[archive][${imageUrl}] start`)
  const { data: imageData } = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
  })
  const fileKey = await uploadBuf(imageData)
  const hash = Buffer.from(fileKey.replaceAll('/', '').substring(0, 8), 'hex')
  const base58 = bs58.encode(hash)
  console.log(`[archive][${imageUrl}] base58:`, base58)
  await redis.hSet(REDIS_SHORTEN_URL_HSET_KEY, base58, fileKey)
  console.log(`[archive][${imageUrl}] done`)

  const thumbnail = `${getUrl(fileKey)}/xs.jpg`
  const orig = `${process.env.BASE_URL}${base58}`
  return [thumbnail, orig]
}

const loop = async () => {
  try {
    const message = await getTask()
    if (!message) return
    const shortenIds: [string, string][] = []
    for (const image of message.images) {
      const shortenId = await archive(image)
      shortenIds.push(shortenId)
    }

    let replyMsg = `图片已归档：\n`
    for (const [thumbnail, orig] of shortenIds) {
      replyMsg += `[CQ:image,file=${thumbnail}] ${orig}\n`
    }
    await http.post('/send_guild_channel_msg', {
      guild_id: message.guildId,
      channel_id: message.channelId,
      message: replyMsg,
    })
  } catch (err) {
    console.log(err)
  }
  loop()
}

loop()
