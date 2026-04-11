import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filamentJobApi } from '../services/api';

const QUERY_KEY = ['filament-jobs'];

export function useFilamentJobs(status?: string) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEY, status],
    queryFn: () => filamentJobApi.getAll(status),
    refetchInterval: 10_000,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, colorId }: { id: number; colorId: number }) =>
      filamentJobApi.resolve(id, colorId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const skipMutation = useMutation({
    mutationFn: (id: number) => filamentJobApi.skip(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    jobs: data?.jobs ?? [],
    pendingCount: data?.pendingCount ?? 0,
    isLoading,
    resolve: resolveMutation.mutate,
    skip: skipMutation.mutate,
    isResolving: resolveMutation.isPending,
    isSkipping: skipMutation.isPending,
  };
}

// Last completed print job for a specific printer — used on the Printer Dashboard card.
export function useLastPrinterJob(printerName: string) {
  const { data } = useQuery({
    queryKey: [...QUERY_KEY, 'last-print', printerName],
    queryFn: () => filamentJobApi.getLastByPrinter(printerName),
    refetchInterval: 30_000,
    enabled: !!printerName,
  });
  return data ?? [];
}

// Filament jobs linked to a specific queue item — used on completed queue items.
export function useQueueItemFilament(queueItemId: number | undefined) {
  const { data } = useQuery({
    queryKey: [...QUERY_KEY, 'queue-item', queueItemId],
    queryFn: () => filamentJobApi.getByQueueItem(queueItemId!),
    enabled: !!queueItemId,
    staleTime: 60_000,
  });
  return data ?? [];
}
