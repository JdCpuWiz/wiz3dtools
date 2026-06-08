import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showcaseAboutApi, type ShowcaseAboutBlock } from '../services/api';
import toast from 'react-hot-toast';

export const useShowcaseAbout = () => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['showcase-about'], queryFn: showcaseAboutApi.getAll });

  const createMutation = useMutation({
    mutationFn: showcaseAboutApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['showcase-about'] }); toast.success('Block created'); },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ShowcaseAboutBlock> }) => showcaseAboutApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['showcase-about'] }); toast.success('Block saved'); },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });
  const deleteMutation = useMutation({
    mutationFn: showcaseAboutApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['showcase-about'] }); toast.success('Block deleted'); },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    createItem: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateItem: (id: string, data: Partial<ShowcaseAboutBlock>) => updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    deleteItem: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};
