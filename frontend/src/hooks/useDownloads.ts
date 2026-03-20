import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { onWsEvent } from '@/hooks/useWebSocket'
import { fetchDownloads } from '@/api/downloads'
import type { DownloadItem } from '@/types'

export function useDownloads() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['downloads'],
    queryFn: fetchDownloads,
    staleTime: 10_000,
  })

  useEffect(() => {
    function patchDownload(patch: Partial<DownloadItem> & { download_id: number }) {
      queryClient.setQueryData<DownloadItem[]>(['downloads'], (old = []) =>
        old.map((d) => (d.id === patch.download_id ? { ...d, ...patch } : d)),
      )
    }

    const unsubs = [
      onWsEvent('download.progress', ({ payload }) => {
        patchDownload({
          download_id: payload.download_id as number,
          status: 'downloading',
          progress: payload.percent as number,
        })
      }),

      onWsEvent('download.completed', ({ payload }) => {
        patchDownload({
          download_id: payload.download_id as number,
          status: 'done',
          progress: 100,
          file_path: payload.file_path as string,
        })
      }),

      onWsEvent('download.failed', ({ payload }) => {
        patchDownload({
          download_id: payload.download_id as number,
          status: 'failed',
          error: payload.error as string,
        })
      }),
    ]

    return () => unsubs.forEach((fn) => fn())
  }, [queryClient])

  return { downloads: data ?? [], isLoading, error }
}
