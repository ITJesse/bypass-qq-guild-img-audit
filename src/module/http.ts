import bs58 from 'bs58'
import express from 'express'
import morgan from 'morgan'

const app: express.Express = express()

app.use(
  morgan(
    '[http] :method :url :status :res[content-length] - :response-time ms',
  ),
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/s/:base58', async (req, res) => {
  const { base58 } = req.params
  const hash = Buffer.from(bs58.decode(base58)).toString('hex')
  const fileKey =
    hash.substring(0, 2) + '/' + hash.substring(2, 4) + '/' + hash.substring(4)
  return res.redirect(301, `${process.env.OSS_BASE_URL}/${fileKey}`)
})

const port = process.env.PORT ?? 3000
app.listen(port, () => {
  console.log(`[http] Listen on port ${port}.`)
})
