import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { uploadApi } from '../services/api';
import toast from 'react-hot-toast';

export const useUpload = () => {
  const [uploadedInvoiceId, setUploadedInvoiceId] = useState<number | null>(null);

  const uploadMutation = useMutation({
    mutationFn: uploadApi.uploadInvoice,
    onSuccess: (data) => {
      setUploadedInvoiceId(data.invoiceId);
      toast.success('Invoice uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const statusQuery = useQuery({
    queryKey: ['invoice-status', uploadedInvoiceId],
    queryFn: () => uploadApi.getInvoiceStatus(uploadedInvoiceId!),
    enabled: uploadedInvoiceId !== null,
    refetchInterval: (query) => {
      // Stop polling once processed
      return query.state.data?.processed ? false : 2000;
    },
  });

  const reset = () => {
    setUploadedInvoiceId(null);
  };

  return {
    upload: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
    invoiceStatus: statusQuery.data,
    isProcessing: statusQuery.data ? !statusQuery.data.processed : false,
    reset,
  };
};
