import WebSocket from 'ws'

import {
    REDIS_ARCHIVER_MESSAGE_QUEUE, REDIS_MESSAGE_RECALL_MARK_PREFIX, REDIS_WORKER_MESSAGE_QUEUE
} from '@/consts'
import { checkFuncAllow, removeFuncAllow, setFuncAllow } from '@/lib/control'
import { http } from '@/lib/http'
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
    const messageData: ImageMessage = {
      id: messageId,
      images,
      time: json.time * 1000,
      guildId: json.guild_id,
      channelId: json.channel_id,
    }

    const jsonData = message.find((e: any) => e.type === 'json')?.data?.data
    if (jsonData && typeof jsonData === 'string') {
      const data = JSON.parse(jsonData)
      const desc = data.meta.detail_1.desc
      const preview = data.meta.detail_1.preview
      const url = data.meta.detail_1.qqdocurl
      if (!url) return
      let content = '该消息手机和电脑都可以看'
      if (preview) {
        content += `[CQ:image,file=http://${preview}]`
      }
      if (desc) {
        content += desc
      }
      content += url
      await http.post('/send_guild_channel_msg', {
        guild_id: messageData.guildId,
        channel_id: messageData.channelId,
        message: content,
      })
      return
    }

    const text = message.find((e: any) => e.type === 'text')?.data.text
    if (text?.startsWith('/func')) {
      const [_, method, func] = text.split(' ')
      if (!['enable', 'disable'].includes(method)) {
        return
      }
      if (!['bypass', 'archive'].includes(func)) {
        return
      }
      const senderId = json.sender.tiny_id
      if (senderId !== process.env.ADMIN_ID) return
      if (method === 'enable') {
        await setFuncAllow(
          func,
          `${messageData.guildId}:${messageData.channelId}`,
        )
        await http.post('/send_guild_channel_msg', {
          guild_id: messageData.guildId,
          channel_id: messageData.channelId,
          message: `已开启该频道的 ${func} 功能`,
        })
      } else if (method === 'disable') {
        await removeFuncAllow(
          func,
          `${messageData.guildId}:${messageData.channelId}`,
        )
        await http.post('/send_guild_channel_msg', {
          guild_id: messageData.guildId,
          channel_id: messageData.channelId,
          message: `已关闭该频道的 ${func} 功能`,
        })
      }
    }

    if (images.length > 0) {
      if (
        await checkFuncAllow(
          'archive',
          `${messageData.guildId}:${messageData.channelId}`,
        )
      ) {
        await redis.rPush(
          REDIS_ARCHIVER_MESSAGE_QUEUE,
          JSON.stringify(messageData),
        )
      }

      if (
        await checkFuncAllow(
          'bypass',
          `${messageData.guildId}:${messageData.channelId}`,
        )
      ) {
        await redis.rPush(
          REDIS_WORKER_MESSAGE_QUEUE,
          JSON.stringify(messageData),
        )
      }
    }
  }
})

ws.on('close', () => {
  console.log('[ws] close')
  process.exit(0)
})
