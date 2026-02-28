import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../services/api';
import toast from 'react-hot-toast';

export const useUsers = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['users'],
    queryFn: userApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: userApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { email?: string | null; role?: string } }) =>
      userApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      userApi.resetPassword(id, password),
    onSuccess: () => toast.success('Password reset successfully'),
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: userApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    users: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    createUser: (data: { username: string; password: string; email?: string; role?: string }) =>
      createMutation.mutateAsync(data),
    updateUser: (id: number, data: { email?: string | null; role?: string }) =>
      updateMutation.mutateAsync({ id, data }),
    resetPassword: (id: number, password: string) =>
      resetPasswordMutation.mutateAsync({ id, password }),
    deleteUser: (id: number) => deleteMutation.mutateAsync(id),
    isCreating: createMutation.isPending,
  };
};
