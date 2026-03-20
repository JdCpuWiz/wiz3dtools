import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colorApi } from '../services/api';
import type { CreateColorDto, UpdateColorDto } from '@wizqueue/shared';
import toast from 'react-hot-toast';

export const useColors = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['colors'],
    queryFn: colorApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: colorApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colors'] });
      toast.success('Color added');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateColorDto }) => colorApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colors'] });
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: colorApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colors'] });
      toast.success('Color deleted');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const addSpoolMutation = useMutation({
    mutationFn: colorApi.addSpool,
    onSuccess: (color) => {
      queryClient.invalidateQueries({ queryKey: ['colors'] });
      toast.success(`Spool added — ${color.inventoryGrams.toFixed(0)}g on hand`);
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    colors: query.data || [],
    isLoading: query.isLoading,
    create: (data: CreateColorDto) => createMutation.mutateAsync(data),
    update: (id: number, data: UpdateColorDto) => updateMutation.mutateAsync({ id, data }),
    delete: (id: number) => deleteMutation.mutateAsync(id),
    addSpool: (id: number) => addSpoolMutation.mutateAsync(id),
    isCreating: createMutation.isPending,
  };
};
