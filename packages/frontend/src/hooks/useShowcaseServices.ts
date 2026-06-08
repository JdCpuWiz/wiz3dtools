import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showcaseServicesApi, type ShowcaseService } from '../services/api';
import toast from 'react-hot-toast';

export const useShowcaseServices = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['showcase-services'],
    queryFn: showcaseServicesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: showcaseServicesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcase-services'] });
      toast.success('Service created');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ShowcaseService> }) =>
      showcaseServicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcase-services'] });
      toast.success('Service saved');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: showcaseServicesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcase-services'] });
      toast.success('Service deleted');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    createItem: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateItem: (id: string, data: Partial<ShowcaseService>) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    deleteItem: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};
