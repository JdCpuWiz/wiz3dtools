import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manufacturerApi } from '../services/api';
import type { CreateManufacturerDto, UpdateManufacturerDto } from '@wizqueue/shared';
import toast from 'react-hot-toast';

export const useManufacturers = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['manufacturers'],
    queryFn: manufacturerApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: manufacturerApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      toast.success('Manufacturer added');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateManufacturerDto }) =>
      manufacturerApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      toast.success('Manufacturer updated');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: manufacturerApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      toast.success('Manufacturer deleted');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    manufacturers: query.data || [],
    isLoading: query.isLoading,
    create: (data: CreateManufacturerDto) => createMutation.mutateAsync(data),
    update: (id: number, data: UpdateManufacturerDto) => updateMutation.mutateAsync({ id, data }),
    delete: (id: number) => deleteMutation.mutateAsync(id),
    isCreating: createMutation.isPending,
  };
};
