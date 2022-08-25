import { REDIS_ALLOW_FUNC_PREFIX } from '@/consts'

import { redisHttpClient } from './redis'

type Func = 'bypass' | 'archive'

export const checkFuncAllow = async (func: Func, key: string) => {
  const redis = await redisHttpClient.getShared()
  const allowKey = `${REDIS_ALLOW_FUNC_PREFIX}${func}`
  const allow = await redis.hGet(allowKey, key)
  console.log(`[permission][${func}][${key}]`, allow ? 'allow' : 'deny')
  return !!allow
}

export const setFuncAllow = async (func: Func, key: string) => {
  console.log(`[permission][${func}][${key}] give permission`)
  const redis = await redisHttpClient.getShared()
  const allowKey = `${REDIS_ALLOW_FUNC_PREFIX}${func}`
  await redis.hSet(allowKey, key, '1')
}

export const removeFuncAllow = async (func: Func, key: string) => {
  console.log(`[permission][${func}][${key}] remove permission`)
  const redis = await redisHttpClient.getShared()
  const allowKey = `${REDIS_ALLOW_FUNC_PREFIX}${func}`
  await redis.hDel(allowKey, key)
}
