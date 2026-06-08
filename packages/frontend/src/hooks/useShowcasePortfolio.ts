import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showcasePortfolioApi, type ShowcasePortfolioItem } from '../services/api';
import toast from 'react-hot-toast';

export const useShowcasePortfolio = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['showcase-portfolio'],
    queryFn: showcasePortfolioApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: showcasePortfolioApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcase-portfolio'] });
      toast.success('Portfolio item created');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ShowcasePortfolioItem> }) =>
      showcasePortfolioApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcase-portfolio'] });
      toast.success('Portfolio item saved');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: showcasePortfolioApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcase-portfolio'] });
      toast.success('Portfolio item deleted');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    createItem: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateItem: (id: string, data: Partial<ShowcasePortfolioItem>) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    deleteItem: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};
