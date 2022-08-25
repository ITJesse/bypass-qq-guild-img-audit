import express, { response } from 'express'
import morgan from 'morgan'

import { REDIS_SHORTEN_URL_HSET_KEY } from '@/consts'
import { redisHttpClient } from '@/lib/redis'

const app: express.Express = express()

app.use(
  morgan(
    '[http] :method :url :status :res[content-length] - :response-time ms',
  ),
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/s/:hash', async (req, res) => {
  const redis = await redisHttpClient.getShared()
  const { hash } = req.params
  const fileKey = await redis.hGet(REDIS_SHORTEN_URL_HSET_KEY, hash)
  if (!fileKey) return res.status(404).send('Not Found')
  return res.redirect(301, `${process.env.OSS_BASE_URL}/${fileKey}`)
})

const port = process.env.PORT ?? 3000
app.listen(port, () => {
  console.log(`[http] Listen on port ${port}.`)
})
