import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createKoboDevice, deleteKoboDevice, fetchKoboDevices } from '@/api/kobo'

export function useKoboDevices() {
  return useQuery({
    queryKey: ['kobo-devices'],
    queryFn: fetchKoboDevices,
  })
}

export function useCreateKoboDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createKoboDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kobo-devices'] }),
  })
}

export function useDeleteKoboDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteKoboDevice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kobo-devices'] }),
  })
}
