import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryApi } from '../services/api';
import type { CreateCategoryDto, UpdateCategoryDto } from '@wizqueue/shared';

export function useCategories() {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryDto) => categoryApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCategoryDto }) => categoryApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => categoryApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  return {
    categories,
    isLoading,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    update: (id: number, data: UpdateCategoryDto) => updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
