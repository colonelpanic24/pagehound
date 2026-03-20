import { Outlet } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from './Sidebar'
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
      </div>
    </TooltipProvider>
  )
}
