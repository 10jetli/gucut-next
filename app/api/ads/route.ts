import { NextResponse } from 'next/server'
import adsData from '@/data/ads.json'

export async function GET() {
  return NextResponse.json(adsData)
}
