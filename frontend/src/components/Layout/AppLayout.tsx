import { Outlet } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from './Sidebar'
import { WsIndicator } from './WsIndicator'
import { JobsEventHandler } from '@/components/Jobs/JobsEventHandler'
import { Toaster } from '@/components/ui/toaster'

export function AppLayout() {
  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Global WS event → jobs store wiring */}
        <JobsEventHandler />

        {/* Toast notifications */}
        <Toaster />

        {/* WS status — fixed to bottom-right of viewport */}
        <div className="fixed bottom-3 right-3 z-50">
          <WsIndicator />
        </div>
      </div>
    </TooltipProvider>
  )
}
