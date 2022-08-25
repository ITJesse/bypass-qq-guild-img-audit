import WebSocket from 'ws'

import {
    REDIS_ARCHIVER_MESSAGE_QUEUE, REDIS_MESSAGE_RECALL_MARK_PREFIX, REDIS_WORKER_MESSAGE_QUEUE
} from '@/consts'
import { redisWsClient } from '@/lib/redis'
import { ImageMessage } from '@/types'

const ws = new WebSocket('ws://10.0.0.115:8080')

ws.on('open', () => console.log('[ws] open'))

ws.on('message', async (data) => {
  const redis = await redisWsClient.getShared()
  const json = JSON.parse(data.toString())
  if (json.meta_event_type === 'heartbeat') return
  const postType = json.post_type
  const noticeType = json.notice_type
  const messageType = json.message_type
  const messageId = json.message_id
  const message = json.message
  console.log(`[ws][message][${postType}]`, data.toString())
  if (postType === 'notice' && noticeType === 'guild_channel_recall') {
    await redis.setEx(
      `${REDIS_MESSAGE_RECALL_MARK_PREFIX}${messageId}`,
      300,
      '1',
    )
    return
  }
  if (postType === 'message' && messageType === 'guild') {
    const images: string[] = message
      .filter((e: any) => e.type === 'image')
      .map((e: any) => e.data.url)

    if (images.length > 0) {
      const messageData: ImageMessage = {
        id: messageId,
        images,
        time: json.time * 1000,
        guildId: json.guild_id,
        channelId: json.channel_id,
      }
      // Add message to archive list
      await redis.rPush(
        REDIS_ARCHIVER_MESSAGE_QUEUE,
        JSON.stringify(messageData),
      )
      await redis.rPush(REDIS_WORKER_MESSAGE_QUEUE, JSON.stringify(messageData))
    }
  }
})

ws.on('close', () => {
  console.log('[ws] close')
  process.exit(0)
})
