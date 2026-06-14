export interface Exhibitor {
  ko: string
  en: string
  country: string
}

export interface Booth {
  id: string
  hall: 'A' | 'B1'
  facility: boolean
  x: number
  y: number
  w: number
  h: number
  color?: string
  exhibitors: Exhibitor[]
}

export interface BoothData {
  viewBox: { w: number; h: number }
  booths: Booth[]
}

export const displayName = (e: Exhibitor) => e.ko || e.en
