export interface ZortStore {
  storename: string
  apikey: string
  apisecret: string
}

export interface Order {
  number: string
  customername: string
  status: string
  amount: number
  saleschannel: string
  createdatetimeString: string
  orderdateString?: string
  trackingno?: string
}

export interface Product {
  sku: string
  name: string
  stock: string
  availablestock?: string
  sellprice?: string
  purchaseprice?: string
  barcode?: string
}

export interface Return {
  number: string
  customername: string
  status: string
  paymentamount: number
  returnorderdateString?: string
  saleschannel?: string
}

// Google Sheets factory order
export interface FactoryOrder {
  id: string
  product: string
  factory: string
  qty: number
  deposit: string
  total: string
  due: string
  status: string
  note: string
  updated: string
  images: string
}
