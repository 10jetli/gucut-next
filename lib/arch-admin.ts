// สร้างอัตโนมัติโดย scripts/gen-arch.mjs ตอน build — **ห้ามแก้ด้วยมือ**
// แก้ที่นี่จะถูกเขียนทับรอบหน้า และทำให้ผังในหน้า /core/arch โกหกจนกว่าจะมีคนสังเกต
export const ARCH_ADMIN = {
  "generatedAt": "2026-09-03T22:39:19.880Z",
  "site": "admin.gucut.com",
  "project": "gucut-admin",
  "repo": "gucut-next",
  "apiRoutes": {
    "count": 37,
    "names": [
      "ads",
      "ai-visibility",
      "auth/login",
      "auth/whoami",
      "bills",
      "bills/download",
      "bills/drivesync",
      "bills/file",
      "bills/fixmonth",
      "bills/upload",
      "bills/vendor",
      "catalog/state",
      "connections",
      "google/auth",
      "google/callback",
      "import",
      "mailcheck",
      "netlify-credits",
      "reorder",
      "returns",
      "returns/received",
      "rokid/v1/chat/completions",
      "rokid/v1/models",
      "sales-report",
      "sheets",
      "shopify/install",
      "shopify/oauth-callback",
      "store/products",
      "telegram/webhook",
      "tracker",
      "tracker/image/[key]",
      "tracker/migrate",
      "tracker/upload",
      "transfer",
      "web/[...path]",
      "webfile/[name]",
      "zort"
    ]
  },
  "pages": {
    "count": 70,
    "core": 36,
    "coreNames": [
      "/core",
      "/core/accounting-docs",
      "/core/arch",
      "/core/backup",
      "/core/branches",
      "/core/bundles",
      "/core/bundles/[sku]",
      "/core/buy-report",
      "/core/categories",
      "/core/channels",
      "/core/chat",
      "/core/customer-report",
      "/core/customers",
      "/core/factory-orders",
      "/core/finance",
      "/core/logistics",
      "/core/manual",
      "/core/missing-sku",
      "/core/money-transfers",
      "/core/moves",
      "/core/other-expense",
      "/core/other-income",
      "/core/peak",
      "/core/pos",
      "/core/purchases",
      "/core/quotations",
      "/core/reports",
      "/core/salepages",
      "/core/sales",
      "/core/sales/detail",
      "/core/soon/[key]",
      "/core/stock",
      "/core/stock/[sku]",
      "/core/transfers",
      "/core/usage",
      "/core/variants"
    ]
  },
  "blobs": [
    "reorder",
    "returns",
    "tracker",
    "tracker-images"
  ],
  "pipe": {
    "allow": [
      "ad-stats",
      "ai-bots",
      "bot-rules",
      "chat",
      "clip-shop",
      "clip-stats",
      "core",
      "coupon",
      "legacy",
      "live",
      "marketing",
      "netlify-credits",
      "orders",
      "permit-doc",
      "points",
      "read-id",
      "reviews-ingest",
      "seo-audit",
      "shopee",
      "social",
      "status",
      "time",
      "video-pick"
    ],
    "count": 23
  },
  "integrations": [
    {
      "id": "zort1",
      "name": "ZORT ร้านหลัก",
      "what": "ออเดอร์ · สต็อก · สินค้า",
      "envs": [
        "ZORT_STORENAME_1",
        "ZORT_APIKEY_1"
      ],
      "inCode": true
    },
    {
      "id": "zort2",
      "name": "ZORT ร้านสาขา",
      "what": "บัญชีที่สอง (ceojet)",
      "envs": [
        "ZORT_STORENAME_2",
        "ZORT_APIKEY_2"
      ],
      "inCode": true
    },
    {
      "id": "pipe",
      "name": "ท่อกลางไปหน้าร้าน",
      "what": "เรียก gucut.com/api/* ด้วยรหัสของตัวเอง",
      "envs": [
        "GUCUT_WEB_ADMIN_KEY",
        "GUCUT_SITE_URL"
      ],
      "inCode": true
    },
    {
      "id": "telegram",
      "name": "Telegram",
      "what": "แจ้งเตือน + รับปุ่มอนุมัติ (webhook)",
      "envs": [
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID"
      ],
      "inCode": true
    },
    {
      "id": "google",
      "name": "Google (Gmail/ไดรฟ์)",
      "what": "เช็คเมลอนุมัติจากมาร์เก็ตเพลส",
      "envs": [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET"
      ],
      "inCode": true
    },
    {
      "id": "ai",
      "name": "ผู้ช่วย AI",
      "what": "งานอ่าน/สรุปในหลังร้าน",
      "envs": [
        "ANTHROPIC_API_KEY",
        "GEMINI_API_KEY"
      ],
      "inCode": true
    },
    {
      "id": "rokid",
      "name": "สะพานแว่น Rokid",
      "what": "ต่อแว่นเข้ากับหลังร้าน",
      "envs": [
        "ROKID_BRIDGE_KEY"
      ],
      "inCode": true
    },
    {
      "id": "shopify",
      "name": "Shopify (ของเก่า)",
      "what": "เหลือค้างจากตอนยังใช้ Shopify",
      "envs": [
        "SHOPIFY_ADMIN_TOKEN",
        "SHOPIFY_STORE_DOMAIN"
      ],
      "inCode": true
    }
  ],
  "unlabelled": []
} as const;
