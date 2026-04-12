import React, { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useCustomer, useCustomers } from '../../hooks/useCustomers';
import { useSalesInvoices } from '../../hooks/useSalesInvoices';
import type { CreateCustomerDto, SalesInvoice } from '@wizqueue/shared';

const statusColors: Record<string, { color: string; bg: string }> = {
  draft:     { color: '#ffffff', bg: '#6b7280' },
  sent:      { color: '#ffffff', bg: '#1d4ed8' },
  paid:      { color: '#ffffff', bg: '#15803d' },
  shipped:   { color: '#ffffff', bg: '#6d28d9' },
  cancelled: { color: '#ffffff', bg: '#b91c1c' },
};

function calcTotal(inv: SalesInvoice): number {
  const subtotal = inv.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0);
  const taxAmount = inv.taxExempt ? 0 : subtotal * inv.taxRate;
  return subtotal + taxAmount + (Number(inv.shippingCost) || 0);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const CustomerForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const customerId = isEdit ? parseInt(id) : 0;

  const { data: existing } = useCustomer(customerId);
  const { create, update, isCreating, isUpdating } = useCustomers();
  const { invoices } = useSalesInvoices();
  const customerInvoices = isEdit
    ? invoices
        .filter((inv) => inv.customerId === customerId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
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

  const labelClass = 'block text-sm font-medium mb-1 text-primary-400';

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

      {/* Invoice History (edit mode only) */}
      {isEdit && (
        <div className="card-surface">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2d2d2d]">
            <h3 className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#ff9900' }}>
              Invoice History
            </h3>
            <Link to={`/invoices/new`} className="btn-primary btn-sm text-xs">+ New Invoice</Link>
          </div>
          {customerInvoices.length === 0 ? (
            <p className="text-sm text-white px-4 py-6">No invoices for this customer yet.</p>
          ) : (
            <table className="wiz-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {customerInvoices.map((inv) => {
                  const displayStatus = inv.shippedAt ? 'shipped' : inv.status;
                  const sc = statusColors[displayStatus] || statusColors.draft;
                  return (
                    <tr key={inv.id}>
                      <td>
                        <Link to={`/invoices/${inv.id}`} className="font-mono text-sm text-[#ff9900] hover:text-[#e68a00]">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="text-white text-sm">{fmtDate(inv.createdAt)}</td>
                      <td>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ color: sc.color, background: sc.bg }}>
                          {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                        </span>
                      </td>
                      <td className="text-right font-medium text-white">
                        ${calcTotal(inv).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
