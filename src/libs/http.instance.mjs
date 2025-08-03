import { BASE_API_URL } from '../constants.mjs'
import axios from 'axios'
import https from 'node:https'

export const useHttpInstance = (token) => {
  const instance = new axios.create({
    baseURL: BASE_API_URL,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': token,
    },
  })
  return instance
}
