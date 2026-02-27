import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi } from '../services/api';
import type { CreateProductDto, UpdateProductDto } from '@wizqueue/shared';
import toast from 'react-hot-toast';

export const useProducts = (activeOnly = false) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['products', { activeOnly }],
    queryFn: () => productApi.getAll(activeOnly),
  });

  const createMutation = useMutation({
    mutationFn: productApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProductDto }) =>
      productApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: productApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
    },
    onError: (error: Error) => {
      // Suppress toast for 409 "used in invoices" — ProductList handles that case
      if (!error.message.includes('used in invoices')) {
        toast.error(`Failed: ${error.message}`);
      }
    },
  });

  return {
    products: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    create: (data: CreateProductDto) => createMutation.mutateAsync(data),
    update: (id: number, data: UpdateProductDto) => updateMutation.mutateAsync({ id, data }),
    delete: (id: number) => deleteMutation.mutateAsync(id),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
