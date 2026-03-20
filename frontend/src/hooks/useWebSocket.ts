/**
 * Singleton WebSocket hook.
 *
 * - Opens one persistent connection on first use.
 * - Reconnects with exponential back-off on disconnect.
 * - Parses the { event, payload, timestamp } envelope and dispatches
 *   to a simple EventTarget-based bus so any component can subscribe.
 * - Sends a ping every 30 s to keep the connection alive.
 */
import { useEffect, useRef, useState } from 'react'

export type WSMessage = {
  event: string
  payload: Record<string, unknown>
  timestamp: string
}

type EventHandler = (msg: WSMessage) => void

// ── Singleton event bus ────────────────────────────────────────────────────────
const bus = new EventTarget()

/** Subscribe to a specific event type. Returns an unsubscribe function. */
export function onWsEvent(event: string, handler: EventHandler): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<WSMessage>).detail)
  bus.addEventListener(event, listener)
  return () => bus.removeEventListener(event, listener)
}

// ── Singleton connection ───────────────────────────────────────────────────────
let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
let backoff = 1000

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws`
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

  ws = new WebSocket(getWsUrl())

  ws.onopen = () => {
    backoff = 1000
    if (pingTimer) clearInterval(pingTimer)
    pingTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'ping', ts: Date.now() }))
      }
    }, 30_000)
  }

  ws.onmessage = (ev) => {
    try {
      const msg: WSMessage = JSON.parse(ev.data as string)
      // Dispatch to specific event listeners
      bus.dispatchEvent(new CustomEvent(msg.event, { detail: msg }))
      // Dispatch to wildcard listeners
      bus.dispatchEvent(new CustomEvent('ws:any', { detail: msg }))
    } catch {
      // ignore unparseable frames
    }
  }

  ws.onclose = () => {
    if (pingTimer) clearInterval(pingTimer)
    ws = null
    scheduleReconnect()
  }

  ws.onerror = () => {
    ws?.close()
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    backoff = Math.min(backoff * 2, 30_000)
    connect()
  }, backoff)
}

// ── Hook — ensures the singleton is started ────────────────────────────────────
let mountCount = 0

export function useWebSocket() {
  useEffect(() => {
    if (mountCount === 0) connect()
    mountCount++
    return () => {
      mountCount--
      // Don't close — keep the singleton alive until the page unloads
    }
  }, [])
}

// ── Connection status hook ────────────────────────────────────────────────────
export function useWsStatus(): 'connected' | 'connecting' | 'disconnected' {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const check = () => {
      if (!ws) { setStatus('disconnected'); return }
      if (ws.readyState === WebSocket.OPEN) setStatus('connected')
      else if (ws.readyState === WebSocket.CONNECTING) setStatus('connecting')
      else setStatus('disconnected')
    }
    check()
    intervalRef.current = setInterval(check, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  return status
}
