import axios from 'axios'
import sharp from 'sharp'

import { REDIS_WORKER_MESSAGE_QUEUE } from '@/consts'
import { http } from '@/lib/http'
import { signUrl, uploadBuf } from '@/lib/oss'
import { redisWorkerClient } from '@/lib/redis'
import { ImageMessage } from '@/types'
import { delay } from '@/utils'

const checkMessage = async (message: ImageMessage) => {
  const redis = await redisWorkerClient.getShared()
  const { data } = await http.get('/get_guild_msg', {
    params: {
      message_id: message.id,
      no_cache: 1,
    },
  })
  if (data.status === 'ok') {
    console.log(`[worker][check message][${message.id}]`, 'pass')
    return true
  }
  console.log(`[worker][check message][${message.id}]`, 'not pass')
  return false
}

const getTask = async () => {
  const redis = await redisWorkerClient.getShared()
  const res = await redis.blPop(REDIS_WORKER_MESSAGE_QUEUE, 60)
  if (!res) return
  const { element: messageData } = res
  if (!messageData) return
  const message = JSON.parse(messageData) as ImageMessage

  if (Date.now() - message.time < 10000) {
    await redis.rPush(REDIS_WORKER_MESSAGE_QUEUE, messageData)
    return null
  }
  return message
}

const cropImage = async (url: string) => {
  const { data: imageData } = await axios.get(url, {
    responseType: 'arraybuffer',
  })
  const meta = await sharp(imageData).metadata()
  const { width, height } = meta
  if (!width || !height) return null
  const cropped = await Promise.all([
    sharp(imageData)
      .extract({
        left: 0,
        top: 0,
        width,
        height: Math.floor(height / 2),
      })
      .toBuffer(),
    sharp(imageData)
      .extract({
        left: 0,
        top: Math.ceil(height / 2),
        width,
        height: Math.ceil(height / 2),
      })
      .toBuffer(),
  ])
  return cropped
}

const worker = async () => {
  const redis = await redisWorkerClient.getShared()
  const message = await getTask()
  if (!message) return
  const pass = await checkMessage(message)
  if (pass) return

  await http.post('/send_guild_channel_msg', {
    guild_id: message.guildId,
    channel_id: message.channelId,
    message: '检测到不许涩涩，正在不服气',
  })

  const images: string[] = []
  for (const image of message.images) {
    const cropped = await cropImage(image)
    if (!cropped) continue
    const fileKeys = await Promise.all(cropped.map((buf) => uploadBuf(buf)))
    const urls = fileKeys.map((key) => signUrl(key))
    images.push(...urls)
  }

  const croppedMessage = images.map((url) => `[CQ:image,file=${url}]`).join('')
  await http.post('/send_guild_channel_msg', {
    guild_id: message.guildId,
    channel_id: message.channelId,
    message: croppedMessage,
  })
}

const loop = async () => {
  try {
    await worker()
  } catch (err) {
    console.log('[worker][error]', err)
  }
  await delay(1000)
  loop()
}

loop()
