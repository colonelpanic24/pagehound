import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { JobsStatusBar } from '@/components/Jobs/JobsStatusBar'
import { JobsEventHandler } from '@/components/Jobs/JobsEventHandler'
import { Toaster } from '@/components/ui/toaster'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main className="flex-1 overflow-y-auto pb-8">
        <Outlet />
      </main>

      {/* Global WS event → jobs store wiring */}
      <JobsEventHandler />

      {/* Persistent jobs status bar */}
      <JobsStatusBar />

      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}
