import https from 'https'

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN ?? ''
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN ?? ''
const API_VERSION = '2024-10'

// เรียก Shopify Admin GraphQL API แบบ server-to-server ด้วย Admin API access token
// (ได้ token มาจากขั้นตอน OAuth ครั้งเดียวผ่าน /api/shopify/install แล้วนำไปตั้งเป็น env var เอง)
export async function shopifyGraphQL(query: string, variables: Record<string, unknown> = {}): Promise<any> {
  const body = JSON.stringify({ query, variables })
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: STORE_DOMAIN,
        path: `/admin/api/${API_VERSION}/graphql.json`,
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': ADMIN_TOKEN,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error(`Shopify non-JSON (${res.statusCode}): ${data.slice(0, 200)}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ดึงรายการสินค้าจากหน้าร้าน Shopify (gucut-store) — ใช้แสดงในเมนู "ผลิตภัณฑ์" ของเว็บไซต์
export async function fetchShopifyProducts(first = 50, after?: string) {
  const query = `
    query Products($first: Int!, $after: String) {
      products(first: $first, after: $after, sortKey: TITLE) {
        edges {
          cursor
          node {
            id
            title
            handle
            status
            totalInventory
            featuredMedia { preview { image { url } } }
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `
  return shopifyGraphQL(query, { first, after: after ?? null })
}
