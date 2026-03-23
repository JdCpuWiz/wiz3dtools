import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { printerApi } from '../services/api';
import type { CreatePrinterDto, UpdatePrinterDto } from '@wizqueue/shared';

const QUERY_KEY = ['printers'];

export function usePrinters() {
  const queryClient = useQueryClient();

  const { data: printers = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: printerApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePrinterDto) => printerApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdatePrinterDto }) => printerApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => printerApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    printers,
    isLoading,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
  };
}
