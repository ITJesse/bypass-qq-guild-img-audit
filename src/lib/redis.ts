import * as redis from 'redis'

const createLazySingleton = <A>(gen: () => Promise<A>) => {
  let store: A | null = null
  let pending = false
  let pendingCallbacks: ((value: A) => void)[] = []

  const getShared: () => Promise<A> = async () => {
    if (store) return store
    if (pending) {
      return new Promise((resolve) => {
        pendingCallbacks.push((v) => {
          resolve(v)
        })
      })
    }
    pending = true
    const res = await gen()
    store = res
    for (const callback of pendingCallbacks) {
      callback(res)
    }
    pending = false
    pendingCallbacks = []
    return res
  }
  return { getShared }
}

export const createRedisClient = (name: string, url: string) =>
  createLazySingleton(async () => {
    const client = redis.createClient({ url })
    client.on('error', (e) => {
      console.error(`[${name}] error:`)
      console.error(e)
    })
    client.on('reconnecting', () => {
      console.log(`[${name}] reconnecting`)
    })
    client.on('connect', () => {
      console.log(`[${name}] connected`)
    })

    try {
      await client.connect()
      return client
    } catch (err) {
      console.log('[redis][${name}] connect failed')
      throw err
    }
  })

export const redisWsClient = createRedisClient(
  'ws-redis',
  `${process.env.REDIS_HOST}`,
)

export const redisWorkerClient = createRedisClient(
  'worker-redis',
  `${process.env.REDIS_HOST}`,
)

export const redisArchiveClient = createRedisClient(
  'archive-redis',
  `${process.env.REDIS_HOST}`,
)

export const redisHttpClient = createRedisClient(
  'http-redis',
  `${process.env.REDIS_HOST}`,
)
