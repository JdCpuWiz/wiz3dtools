import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi } from '../services/api';
import type { CreateCustomerDto, UpdateCustomerDto } from '@wizqueue/shared';
import toast from 'react-hot-toast';

export const useCustomers = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['customers'],
    queryFn: customerApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: customerApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCustomerDto }) =>
      customerApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: customerApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    customers: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    create: (data: CreateCustomerDto) => createMutation.mutateAsync(data),
    update: (id: number, data: UpdateCustomerDto) => updateMutation.mutateAsync({ id, data }),
    delete: (id: number) => deleteMutation.mutateAsync(id),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

export const useCustomer = (id: number) => {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => customerApi.getById(id),
    enabled: !!id,
  });
};
