import axios from 'axios'

export const http = axios.create({
  baseURL: process.env.GO_CQHTTP_HTTP_ENDPOINT,
  timeout: 15000,
})
