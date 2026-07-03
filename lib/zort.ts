import type { ZortStore } from './types'
import https from 'https'

export const STORES: Record<string, ZortStore> = {
  '1': {
    storename: process.env.ZORT_STORENAME_1 ?? 'gucut@icloud.com',
    apikey:    process.env.ZORT_APIKEY_1    ?? '',
    apisecret: process.env.ZORT_APISECRET_1 ?? '',
  },
  '2': {
    storename: process.env.ZORT_STORENAME_2 ?? 'ceojet@gmail.com',
    apikey:    process.env.ZORT_APIKEY_2    ?? '',
    apisecret: process.env.ZORT_APISECRET_2 ?? '',
  },
}

export async function zortFetch(
  endpoint: string,
  params: Record<string, string> = {},
  storeId = '1'
): Promise<unknown> {
  const store = STORES[storeId] ?? STORES['1']
  const qs = new URLSearchParams(params).toString()
  const url = `https://open-api.zortout.com/v4/${endpoint}${qs ? '?' + qs : ''}`
  const targetUrl = new URL(url)

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: targetUrl.hostname,
        path: targetUrl.pathname + (targetUrl.search || ''),
        method: 'GET',
        headers: {
          storename:  store.storename,
          apikey:     store.apikey,
          apisecret:  store.apisecret,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error(`ZORT non-JSON (${res.statusCode}): ${data.slice(0, 200)}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}
