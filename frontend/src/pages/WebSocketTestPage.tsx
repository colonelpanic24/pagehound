/**
 * Phase 1 test page — verifies WS ping works end-to-end.
 * Reachable at /ws-test.
 */
import { useState, useEffect } from 'react'
import { onWsEvent, useWsStatus } from '@/hooks/useWebSocket'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LogEntry {
  ts: string
  event: string
  payload: string
}

export function WebSocketTestPage() {
  const status = useWsStatus()
  const [log, setLog] = useState<LogEntry[]>([])

  useEffect(() => {
    // 'ws:any' receives every event dispatched through the WS bus
    return onWsEvent('ws:any', (msg) => {
      setLog((prev) => [
        { ts: msg.timestamp, event: msg.event, payload: JSON.stringify(msg.payload) },
        ...prev.slice(0, 49),
      ])
    })
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">WebSocket Test</h1>
        <Badge
          className={cn(
            status === 'connected' && 'bg-green-500 text-white border-transparent',
            status === 'connecting' && 'bg-yellow-400 text-black border-transparent',
            status === 'disconnected' && 'bg-destructive text-destructive-foreground border-transparent'
          )}
        >
          {status}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        When connected you should see a <code className="font-mono text-xs bg-muted px-1 rounded">system.connected</code> event
        below immediately, and a <code className="font-mono text-xs bg-muted px-1 rounded">pong</code> event each 30 s from the keep-alive ping.
      </p>

      <div className="rounded-lg border bg-muted/40 p-4 space-y-2 font-mono text-xs max-h-[60vh] overflow-y-auto">
        {log.length === 0 ? (
          <p className="text-muted-foreground">Waiting for events…</p>
        ) : (
          log.map((entry, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {new Date(entry.ts).toLocaleTimeString()}
              </span>
              <span className="text-primary font-semibold shrink-0">{entry.event}</span>
              <span className="text-foreground/70 break-all">{entry.payload}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
