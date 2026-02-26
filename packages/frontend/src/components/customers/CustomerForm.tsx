import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useCustomer, useCustomers } from '../../hooks/useCustomers';
import type { CreateCustomerDto } from '@wizqueue/shared';

export const CustomerForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const customerId = isEdit ? parseInt(id) : 0;

  const { data: existing } = useCustomer(customerId);
  const { create, update, isCreating, isUpdating } = useCustomers();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateCustomerDto>();

  useEffect(() => {
    if (existing) {
      reset({
        contactName: existing.contactName,
        businessName: existing.businessName || '',
        email: existing.email || '',
        phone: existing.phone || '',
        addressLine1: existing.addressLine1 || '',
        addressLine2: existing.addressLine2 || '',
        city: existing.city || '',
        stateProvince: existing.stateProvince || '',
        postalCode: existing.postalCode || '',
        country: existing.country || 'New Zealand',
        notes: existing.notes || '',
      });
    }
  }, [existing, reset]);

  const onSubmit = async (data: CreateCustomerDto) => {
    if (isEdit) { await update(customerId, data); } else { await create(data); }
    navigate('/customers');
  };

  const labelClass = 'block text-sm font-medium text-iron-100 mb-1';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/customers')} className="text-sm text-iron-400 hover:text-iron-50 transition-colors">← Back</button>
        <h2 className="text-xl font-semibold text-iron-50">{isEdit ? 'Edit Customer' : 'New Customer'}</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Contact Name *</label>
            <input {...register('contactName', { required: 'Required' })} className="input" placeholder="Jane Smith" />
            {errors.contactName && <p className="text-red-400 text-xs mt-1">{errors.contactName.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Business Name</label>
            <input {...register('businessName')} className="input" placeholder="Acme Ltd" />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input {...register('email')} type="email" className="input" placeholder="jane@example.com" />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input {...register('phone')} className="input" placeholder="+64 21 000 000" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Address Line 1</label>
          <input {...register('addressLine1')} className="input" placeholder="123 Main St" />
        </div>
        <div>
          <label className={labelClass}>Address Line 2</label>
          <input {...register('addressLine2')} className="input" placeholder="Apt 4B" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>City</label>
            <input {...register('city')} className="input" placeholder="Auckland" />
          </div>
          <div>
            <label className={labelClass}>State / Province</label>
            <input {...register('stateProvince')} className="input" placeholder="AKL" />
          </div>
          <div>
            <label className={labelClass}>Postal Code</label>
            <input {...register('postalCode')} className="input" placeholder="1010" />
          </div>
        </div>

        <div>
          <label className={labelClass}>Country</label>
          <input {...register('country')} className="input" placeholder="New Zealand" />
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea {...register('notes')} rows={3} className="input resize-none" placeholder="Any additional notes..." />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/customers')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isCreating || isUpdating} className="btn-primary">
            {isCreating || isUpdating ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Customer'}
          </button>
        </div>
      </form>
    </div>
  );
};
