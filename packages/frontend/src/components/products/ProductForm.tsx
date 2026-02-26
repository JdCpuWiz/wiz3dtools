import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useProducts } from '../../hooks/useProducts';
import { productApi } from '../../services/api';
import { useQuery } from '@tanstack/react-query';
import type { CreateProductDto } from '@wizqueue/shared';

export const ProductForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const productId = isEdit ? parseInt(id) : 0;

  const { data: existing } = useQuery({
    queryKey: ['products', productId],
    queryFn: () => productApi.getById(productId),
    enabled: isEdit,
  });

  const { create, update, isCreating, isUpdating } = useProducts();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateProductDto>();

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name,
        description: existing.description || '',
        unitPrice: existing.unitPrice,
        active: existing.active,
      });
    }
  }, [existing, reset]);

  const onSubmit = async (data: CreateProductDto) => {
    if (isEdit) {
      await update(productId, data);
    } else {
      await create(data);
    }
    navigate('/products');
  };

  const fieldClass = 'input';
  const labelClass = 'block text-sm font-medium text-iron-100 mb-1';

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/products')}
          className="text-sm text-iron-400 hover:text-iron-50 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-xl font-semibold text-iron-50">
          {isEdit ? 'Edit Product' : 'New Product'}
        </h2>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="card space-y-5"
      >
        <div>
          <label className={labelClass}>Name *</label>
          <input
            {...register('name', { required: 'Required' })}
            className={fieldClass}
            placeholder="e.g. Custom Miniature Print"
          />
          {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            {...register('description')}
            rows={3}
            className={`${fieldClass} resize-none`}
            placeholder="Optional description of this product..."
          />
        </div>

        <div>
          <label className={labelClass}>Unit Price ($) *</label>
          <input
            type="number"
            min={0}
            step={0.01}
            {...register('unitPrice', { required: 'Required', valueAsNumber: true, min: 0 })}
            className={fieldClass}
            placeholder="0.00"
          />
          {errors.unitPrice && <p className="text-red-400 text-xs mt-1">{errors.unitPrice.message}</p>}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="active"
            defaultChecked
            {...register('active')}
            className="h-4 w-4 rounded accent-primary-500"
          />
          <label htmlFor="active" className="text-sm font-medium text-iron-100">
            Active (available for use in invoices)
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCreating || isUpdating}
            className="btn-primary"
          >
            {isCreating || isUpdating ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
};
