import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TabletSmartphone, Plus, Trash2, Copy, Check, Rss, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/useToast'
import { useKoboDevices, useCreateKoboDevice, useDeleteKoboDevice } from '@/hooks/useKobo'
import { fetchSettings } from '@/api/settings'
import type { KoboDevice } from '@/types'

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }
  return { copied, copy }
}

function DeviceCard({
  device,
  onDelete,
}: {
  device: KoboDevice
  onDelete: (id: number) => void
}) {
  const { copied, copy } = useCopy()

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TabletSmartphone className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-sm truncate">{device.name}</span>
          {device.device_id ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">paired</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">not yet connected</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive shrink-0 h-7 w-7 p-0"
          onClick={() => onDelete(device.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {device.last_synced && (
        <p className="text-xs text-muted-foreground">
          Last synced: {new Date(device.last_synced).toLocaleString()}
        </p>
      )}

      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Kobo store URL — paste this into your Kobo settings</p>
        <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
          <code className="flex-1 text-xs break-all select-all">{device.sync_url}</code>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => copy(device.sync_url, String(device.id))}
          >
            {copied === String(device.id) ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function AddDeviceForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Device name (e.g. Libra Colour)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" size="sm" disabled={!name.trim()} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Add
      </Button>
    </form>
  )
}

export function KoboPage() {
  const { data: devices = [], isLoading } = useKoboDevices()
  const createDevice = useCreateKoboDevice()
  const deleteDevice = useDeleteKoboDevice()
  const { copied, copy } = useCopy()
  const { data: settings } = useQuery({ queryKey: ['app-settings'], queryFn: fetchSettings })

  const opdsUrl = `${window.location.origin}/opds`
  const baseUrlIsLocalhost = settings ? /localhost|127\.0\.0\.1/.test(settings.base_url) : false

  const handleAdd = (name: string) => {
    createDevice.mutate(name, {
      onError: () => toast({ title: 'Error', description: 'Failed to add device', variant: 'destructive' }),
    })
  }

  const handleDelete = (id: number) => {
    deleteDevice.mutate(id, {
      onError: () => toast({ title: 'Error', description: 'Failed to remove device', variant: 'destructive' }),
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kobo Sync</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Register your Kobo e-readers and browse your library directly from the device.
        </p>
      </div>

      {/* Base URL warning */}
      {baseUrlIsLocalhost && (
        <div className="flex gap-2.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>BASE_URL is set to localhost.</strong> Kobo devices on your network cannot reach this address.
            Set <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">BASE_URL</code> in{' '}
            <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">backend/.env</code> to your
            server's LAN IP or hostname and restart the backend.
          </div>
        </div>
      )}

      {/* Devices section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Registered Devices</h2>
        </div>

        <AddDeviceForm onAdd={handleAdd} />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : devices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 flex flex-col items-center gap-2 text-center">
            <TabletSmartphone className="h-8 w-8 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No devices registered yet</p>
            <p className="text-xs text-muted-foreground">Add a device above to get your pairing URL.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {devices.map((d) => (
              <DeviceCard key={d.id} device={d} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>

      {/* Setup instructions */}
      <section className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
        <h2 className="font-semibold text-sm">How to pair your Kobo</h2>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Add a device above and copy its store URL.</li>
          <li>On your Kobo, go to <strong>Settings → Store → Beta Features</strong>.</li>
          <li>Enable <strong>Custom content server</strong> and paste the URL.</li>
          <li>Restart the Kobo — it will sync your library automatically.</li>
        </ol>
      </section>

      {/* OPDS section */}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">OPDS Feed</h2>
        <p className="text-sm text-muted-foreground">
          Use this URL in any OPDS-compatible reader (Koreader, Libby, etc.) to browse and download books.
        </p>
        <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
          <Rss className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <code className="flex-1 text-xs break-all select-all">{opdsUrl}</code>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => copy(opdsUrl, 'opds')}
          >
            {copied === 'opds' ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </section>
    </div>
  )
}
