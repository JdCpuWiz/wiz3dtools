import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wholesaleUserApi } from '../services/api';
import toast from 'react-hot-toast';

export const useWholesaleUsers = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['wholesale-users'],
    queryFn: wholesaleUserApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: wholesaleUserApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-users'] });
      toast.success('Wholesale account created');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof wholesaleUserApi.update>[1] }) =>
      wholesaleUserApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-users'] });
      toast.success('Wholesale account updated');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: wholesaleUserApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-users'] });
      toast.success('Wholesale account deleted');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    users: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    createUser: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateUser: (id: string, data: Parameters<typeof wholesaleUserApi.update>[1]) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    deleteUser: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};
