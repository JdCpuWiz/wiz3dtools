import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useProducts } from '../../hooks/useProducts';
import { productApi } from '../../services/api';
import { useColors } from '../../hooks/useColors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProductDto, ProductColorDto } from '@wizqueue/shared';

interface ProductFormFields extends CreateProductDto {
  sku?: string;
}

interface ColorWeightEntry {
  colorId: number;
  weightGrams: string; // string for input binding
  sortOrder: number;
}

const inputSt: React.CSSProperties = {
  background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)',
  border: 'none',
  boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)',
};

export const ProductForm: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const productId = isEdit ? parseInt(id) : 0;
  const queryClient = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ['products', productId],
    queryFn: () => productApi.getById(productId),
    enabled: isEdit,
  });

  const { colors: availableColors } = useColors();
  const { create, update, isCreating, isUpdating } = useProducts();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductFormFields>();

  const skuManuallyEdited = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [skuLoading, setSkuLoading] = useState(false);

  // Color+weight state for product
  const [colorWeights, setColorWeights] = useState<ColorWeightEntry[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string>('');

  const watchedName = watch('name', '');

  useEffect(() => {
    if (existing) {
      skuManuallyEdited.current = !!existing.sku;
      reset({
        name: existing.name,
        description: existing.description || '',
        sku: existing.sku || '',
        unitPrice: existing.unitPrice,
        active: existing.active,
      });
      // Load existing product colors
      if (existing.colors && existing.colors.length > 0) {
        setColorWeights(
          existing.colors.map((pc) => ({
            colorId: pc.colorId,
            weightGrams: String(pc.weightGrams),
            sortOrder: pc.sortOrder,
          })),
        );
      }
    }
  }, [existing, reset]);

  // Debounced SKU suggestion on name change
  useEffect(() => {
    if (!watchedName || skuManuallyEdited.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSkuLoading(true);
      try {
        const suggested = await productApi.suggestSku(watchedName, isEdit ? productId : undefined);
        setValue('sku', suggested);
      } catch {
        // ignore
      } finally {
        setSkuLoading(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [watchedName, isEdit, productId, setValue]);

  const addColor = () => {
    const cid = parseInt(selectedColorId);
    if (!cid || colorWeights.some((c) => c.colorId === cid)) return;
    setColorWeights((prev) => [
      ...prev,
      { colorId: cid, weightGrams: '0', sortOrder: prev.length },
    ]);
    setSelectedColorId('');
  };

  const removeColor = (colorId: number) => {
    setColorWeights((prev) => prev.filter((c) => c.colorId !== colorId).map((c, i) => ({ ...c, sortOrder: i })));
  };

  const updateWeight = (colorId: number, value: string) => {
    setColorWeights((prev) => prev.map((c) => c.colorId === colorId ? { ...c, weightGrams: value } : c));
  };

  const totalGrams = colorWeights.reduce((s, c) => s + (parseFloat(c.weightGrams) || 0), 0);

  const onSubmit = async (data: ProductFormFields) => {
    let savedProductId = productId;
    if (isEdit) {
      await update(productId, data);
    } else {
      const created = await create(data);
      savedProductId = created.id;
    }

    // Save product colors
    const colorDtos: ProductColorDto[] = colorWeights.map((c, i) => ({
      colorId: c.colorId,
      weightGrams: parseFloat(c.weightGrams) || 0,
      sortOrder: i,
    }));
    await productApi.setColors(savedProductId, colorDtos);
    queryClient.invalidateQueries({ queryKey: ['products'] });

    navigate('/products');
  };

  const fieldClass = 'input';
  const labelClass = 'block text-sm font-medium text-iron-100 mb-1';

  const usedColorIds = new Set(colorWeights.map((c) => c.colorId));
  const remainingColors = availableColors.filter((c) => c.active && !usedColorIds.has(c.id));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="card space-y-5">
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
            <label className={labelClass}>
              SKU
              {skuLoading && <span className="ml-2 text-xs text-iron-500">generating…</span>}
            </label>
            <input
              {...register('sku')}
              className={fieldClass}
              placeholder="e.g. CMP-001"
              onChange={(e) => {
                skuManuallyEdited.current = e.target.value.length > 0;
                register('sku').onChange(e);
              }}
            />
            <p className="text-xs text-iron-500 mt-1">Auto-generated from name. Edit to override.</p>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              {...register('description')}
              rows={4}
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
        </div>

        {/* Filament Colors + Weights */}
        <div className="card space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-iron-50">Filament Colors &amp; Weights</h3>
            <p className="text-xs text-iron-400 mt-0.5">
              Enter per-color filament usage from your slicer (in grams per print).
              {totalGrams > 0 && (
                <span className="ml-2 font-semibold" style={{ color: '#ff9900' }}>
                  Total: {totalGrams.toFixed(1)}g
                </span>
              )}
            </p>
          </div>

          {/* Color rows */}
          {colorWeights.map((entry) => {
            const color = availableColors.find((c) => c.id === entry.colorId);
            if (!color) return null;
            return (
              <div key={entry.colorId} className="flex items-center gap-3">
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: color.hex,
                    border: '2px solid rgba(255,255,255,0.15)',
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
                <span className="text-sm text-iron-100 flex-1 min-w-0 truncate">{color.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={entry.weightGrams}
                    onChange={(e) => updateWeight(entry.colorId, e.target.value)}
                    className="w-20 px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-right"
                    style={inputSt}
                  />
                  <span className="text-xs text-iron-400">g</span>
                  <button
                    type="button"
                    onClick={() => removeColor(entry.colorId)}
                    className="text-iron-500 hover:text-red-400 transition-colors ml-1 text-sm leading-none"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add color row */}
          {remainingColors.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <select
                value={selectedColorId}
                onChange={(e) => setSelectedColorId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                style={inputSt}
              >
                <option value="">— Add a color —</option>
                {remainingColors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addColor}
                disabled={!selectedColorId}
                className="btn-secondary btn-sm"
              >
                Add
              </button>
            </div>
          )}

          {colorWeights.length === 0 && (
            <p className="text-xs text-iron-500 italic">No colors assigned. Add colors to enable filament weight tracking.</p>
          )}
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
