import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queueApi } from '../services/api';
import type {
  UpdateQueueItemDto,
} from '@wizqueue/shared';
import toast from 'react-hot-toast';

export const useQueue = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['queue'],
    queryFn: queueApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: queueApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Item added to queue');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add item: ${error.message}`);
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: queueApi.createBatch,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success(`${data.length} items added to queue`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add items: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateQueueItemDto }) =>
      queueApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Item updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: queueApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Item deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete item: ${error.message}`);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: queueApi.reorder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder: ${error.message}`);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      queueApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Status updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    create: createMutation.mutate,
    createBatch: createBatchMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    reorder: reorderMutation.mutate,
    updateStatus: updateStatusMutation.mutate,
  };
};
