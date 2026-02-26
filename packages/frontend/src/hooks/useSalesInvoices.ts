import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesInvoiceApi } from '../services/api';
import type {
  CreateSalesInvoiceDto,
  UpdateSalesInvoiceDto,
  CreateLineItemDto,
} from '@wizqueue/shared';
import toast from 'react-hot-toast';

export const useSalesInvoices = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['sales-invoices'],
    queryFn: salesInvoiceApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: salesInvoiceApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      toast.success('Invoice created');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSalesInvoiceDto }) =>
      salesInvoiceApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', id] });
      toast.success('Invoice updated');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: salesInvoiceApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      toast.success('Invoice deleted');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const sendEmailMutation = useMutation({
    mutationFn: salesInvoiceApi.sendEmail,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', id] });
      toast.success('Invoice sent successfully');
    },
    onError: (error: Error) => toast.error(`Failed to send: ${error.message}`),
  });

  const sendToQueueMutation = useMutation({
    mutationFn: ({ id, lineItemIds }: { id: number; lineItemIds?: number[] }) =>
      salesInvoiceApi.sendToQueue(id, lineItemIds),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Added to print queue');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    invoices: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    create: (data: CreateSalesInvoiceDto) => createMutation.mutateAsync(data),
    update: (id: number, data: UpdateSalesInvoiceDto) => updateMutation.mutateAsync({ id, data }),
    delete: (id: number) => deleteMutation.mutateAsync(id),
    sendEmail: (id: number) => sendEmailMutation.mutateAsync(id),
    sendToQueue: (id: number, lineItemIds?: number[]) =>
      sendToQueueMutation.mutateAsync({ id, lineItemIds }),
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSending: sendEmailMutation.isPending,
  };
};

export const useSalesInvoice = (id: number) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['sales-invoices', id],
    queryFn: () => salesInvoiceApi.getById(id),
    enabled: !!id,
  });

  const addLineItemMutation = useMutation({
    mutationFn: (data: CreateLineItemDto) => salesInvoiceApi.addLineItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', id] });
      toast.success('Line item added');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const updateLineItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: Partial<CreateLineItemDto> }) =>
      salesInvoiceApi.updateLineItem(id, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', id] });
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  const deleteLineItemMutation = useMutation({
    mutationFn: (itemId: number) => salesInvoiceApi.deleteLineItem(id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices', id] });
      toast.success('Line item removed');
    },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    invoice: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    addLineItem: (data: CreateLineItemDto) => addLineItemMutation.mutateAsync(data),
    updateLineItem: (itemId: number, data: Partial<CreateLineItemDto>) =>
      updateLineItemMutation.mutateAsync({ itemId, data }),
    deleteLineItem: (itemId: number) => deleteLineItemMutation.mutateAsync(itemId),
  };
};
