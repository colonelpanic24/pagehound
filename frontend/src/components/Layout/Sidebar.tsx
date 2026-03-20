import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  BookOpen, Search, Download, Settings, Library, Sparkles,
  ChevronsLeft, ChevronsRight, Loader2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useActiveJobs } from '@/components/Jobs/JobsStore'
import { useWsStatus } from '@/hooks/useWebSocket'
import { useReviewQueue } from '@/hooks/useReviewQueue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const topNavItems = [
  { to: '/', label: 'Library', icon: Library, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/downloads', label: 'Downloads', icon: Download },
]

export function Sidebar() {
  const navigate = useNavigate()
  const activeJobs = useActiveJobs()
  const wsStatus = useWsStatus()
  const { pendingCount } = useReviewQueue()
  const hasActiveJobs = activeJobs.length > 0
  const latestJob = activeJobs[0]

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar.collapsed') === 'true'
  )

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem('sidebar.collapsed', String(!c))
      return !c
    })
  }

  return (
    <aside
      className={cn(
        'h-screen flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col',
        'transition-[width] duration-200 ease-in-out overflow-hidden',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center py-5 px-4 shrink-0', collapsed ? 'justify-center' : 'gap-2.5')}>
        <BookOpen className="h-6 w-6 text-primary shrink-0" />
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight text-foreground whitespace-nowrap overflow-hidden">
            PageHound
          </span>
        )}
      </div>

      {/* Top nav — scrollable if needed, but won't overflow the viewport */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
        {topNavItems.map(({ to, label, icon: Icon, end }) => (
          <NavItem key={to} to={to} icon={<Icon className="h-5 w-5" />} collapsed={collapsed} end={end}>
            {label}
          </NavItem>
        ))}
        <NavItem
          to="/review"
          icon={<Sparkles className="h-5 w-5" />}
          collapsed={collapsed}
          badge={pendingCount > 0 ? pendingCount : undefined}
        >
          Review
        </NavItem>
      </nav>

      {/* Bottom section — always visible */}
      <div className="shrink-0 px-2 pb-2 flex flex-col gap-0.5">
        {/* Active job status widget */}
        {hasActiveJobs && (
          <div
            onClick={() => navigate('/downloads')}
            className={cn(
              'mb-1 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors cursor-pointer',
              collapsed && 'flex justify-center px-0'
            )}
          >
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger className="cursor-pointer">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </TooltipTrigger>
                <TooltipContent side="right">
                  {latestJob.message ?? latestJob.label}
                  {latestJob.percent != null && ` (${latestJob.percent}%)`}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
                <span className="truncate">{latestJob.message ?? latestJob.label}</span>
                {latestJob.percent != null && (
                  <span className="shrink-0 tabular-nums">{latestJob.percent}%</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        <NavItem to="/settings" icon={<Settings className="h-5 w-5" />} collapsed={collapsed}>
          Settings
        </NavItem>

        {/* WS dot + collapse toggle */}
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex items-center gap-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors px-3 py-2.5',
            collapsed && 'justify-center'
          )}
        >
          {collapsed
            ? <ChevronsRight className="h-5 w-5 shrink-0" />
            : <ChevronsLeft className="h-5 w-5 shrink-0" />
          }
          <WsIndicator status={wsStatus} />
        </button>
      </div>
    </aside>
  )
}

function NavItem({
  to, icon, children, end, collapsed, badge,
}: {
  to: string
  icon: ReactNode
  children: ReactNode
  end?: boolean
  collapsed?: boolean
  badge?: number
}) {
  const link = (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-md font-medium transition-colors',
          collapsed ? 'justify-center px-3 py-2.5' : 'gap-3 px-3 py-2.5',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )
      }
    >
      <span className="relative shrink-0">
        {icon}
        {badge != null && collapsed && (
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center leading-none">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      {!collapsed && <span className="flex-1 text-base">{children}</span>}
      {!collapsed && badge != null && (
        <span className="ml-auto shrink-0 h-5 min-w-5 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center px-1 tabular-nums">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger className="block">{link}</TooltipTrigger>
        <TooltipContent side="right">{children}{badge != null ? ` (${badge})` : ''}</TooltipContent>
      </Tooltip>
    )
  }

  return link
}

function WsIndicator({ status }: { status: 'connected' | 'connecting' | 'disconnected' }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full shrink-0',
        status === 'connected' && 'bg-success',
        status === 'connecting' && 'bg-yellow-400 animate-pulse',
        status === 'disconnected' && 'bg-destructive'
      )}
    />
  )
}
