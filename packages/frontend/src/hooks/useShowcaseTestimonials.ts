import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showcaseTestimonialsApi, type ShowcaseTestimonial } from '../services/api';
import toast from 'react-hot-toast';

export const useShowcaseTestimonials = () => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['showcase-testimonials'], queryFn: showcaseTestimonialsApi.getAll });

  const createMutation = useMutation({
    mutationFn: showcaseTestimonialsApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['showcase-testimonials'] }); toast.success('Testimonial created'); },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ShowcaseTestimonial> }) => showcaseTestimonialsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['showcase-testimonials'] }); toast.success('Testimonial saved'); },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });
  const deleteMutation = useMutation({
    mutationFn: showcaseTestimonialsApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['showcase-testimonials'] }); toast.success('Testimonial deleted'); },
    onError: (error: Error) => toast.error(`Failed: ${error.message}`),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    createItem: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateItem: (id: string, data: Partial<ShowcaseTestimonial>) => updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    deleteItem: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};
