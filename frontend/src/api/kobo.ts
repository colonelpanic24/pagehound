import type { KoboDevice } from '@/types'

const BASE = '/api/kobo'

export async function fetchKoboDevices(): Promise<KoboDevice[]> {
  const res = await fetch(`${BASE}/devices`)
  if (!res.ok) throw new Error('Failed to fetch Kobo devices')
  return res.json()
}

export async function createKoboDevice(name: string): Promise<KoboDevice> {
  const res = await fetch(`${BASE}/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Failed to create Kobo device')
  return res.json()
}

export async function deleteKoboDevice(id: number): Promise<void> {
  const res = await fetch(`${BASE}/devices/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete Kobo device')
}
