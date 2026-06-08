import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showcaseMaterialsApi, type ShowcaseMaterial } from '../services/api';
import toast from 'react-hot-toast';

export const useShowcaseMaterials = () => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['showcase-materials'], queryFn: showcaseMaterialsApi.getAll });

  const createMutation = useMutation({
    mutationFn: showcaseMaterialsApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['showcase-materials'] }); toast.success('Material created'); },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ShowcaseMaterial> }) => showcaseMaterialsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['showcase-materials'] }); toast.success('Material saved'); },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });
  const deleteMutation = useMutation({
    mutationFn: showcaseMaterialsApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['showcase-materials'] }); toast.success('Material deleted'); },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    createItem: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateItem: (id: string, data: Partial<ShowcaseMaterial>) => updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    deleteItem: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};
