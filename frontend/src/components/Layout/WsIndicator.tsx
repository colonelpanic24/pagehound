import { cn } from '@/lib/utils'
import { useWsStatus } from '@/hooks/useWebSocket'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const WS_TOOLTIP: Record<'connected' | 'connecting' | 'disconnected', string> = {
  connected: 'Connected to server',
  connecting: 'Connecting to server…',
  disconnected: 'Disconnected from server',
}

export function WsIndicator() {
  const status = useWsStatus()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full cursor-default',
            status === 'connected' && 'bg-success',
            status === 'connecting' && 'bg-yellow-400 animate-pulse',
            status === 'disconnected' && 'bg-destructive'
          )}
        />
      </TooltipTrigger>
      <TooltipContent side="top">{WS_TOOLTIP[status]}</TooltipContent>
    </Tooltip>
  )
}
