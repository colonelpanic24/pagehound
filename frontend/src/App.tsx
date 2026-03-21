import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './components/Layout/AppLayout'
import { LibraryPage } from './pages/LibraryPage'
import { SearchPage } from './pages/SearchPage'
import { DownloadsPage } from './pages/DownloadsPage'
import { SettingsPage } from './components/Settings/SettingsPage'
import { ReviewQueuePage } from './pages/ReviewQueuePage'
import { ReaderPage } from './pages/ReaderPage'
import { KoboPage } from './pages/KoboPage'
import { useWebSocket } from './hooks/useWebSocket'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

function WsInitializer() {
  useWebSocket()
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <WsInitializer />
        <Routes>
          <Route path="/read/:bookId" element={<ReaderPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<LibraryPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/downloads" element={<DownloadsPage />} />
            <Route path="/review" element={<ReviewQueuePage />} />
            <Route path="/kobo" element={<KoboPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
