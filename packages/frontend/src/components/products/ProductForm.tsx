import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useProducts } from '../../hooks/useProducts';
import { productApi } from '../../services/api';
import { useColors } from '../../hooks/useColors';
import { useCategories } from '../../hooks/useCategories';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Color, CreateProductDto, ProductColorDto, ProductImage } from '@wizqueue/shared';

interface ProductFormFields extends CreateProductDto {
  sku?: string;
  publishedToStore?: boolean;
  categoryId?: number | null;
  storeTitle?: string;
  storeDescription?: string;
  wholesalePrice?: number;
  retailPrice?: number;
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

function ColorDropdown({ colors, value, onChange, onAdd }: {
  colors: Color[];
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = colors.find((c) => String(c.id) === value);

  // Group by manufacturer (order preserved from API)
  const groups: { mfgName: string; colors: Color[] }[] = [];
  for (const c of colors) {
    const mfgName = c.manufacturer?.name ?? 'No Manufacturer';
    const existing = groups.find((g) => g.mfgName === mfgName);
    if (existing) existing.colors.push(c);
    else groups.push({ mfgName, colors: [c] });
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex items-center gap-2 pt-1" ref={ref}>
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left focus:outline-none focus:ring-1 focus:ring-primary-500"
          style={inputSt}
        >
          {selected ? (
            <>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: selected.hex, border: `2px solid ${selected.hex}`, flexShrink: 0, display: 'inline-block' }} />
              <span className="text-white">{selected.name}</span>
            </>
          ) : (
            <span className="text-white">— Add a color —</span>
          )}
          <span className="ml-auto text-white text-xs">▼</span>
        </button>

        {open && (
          <div
            className="absolute z-50 w-full mt-1 rounded-lg overflow-y-auto"
            style={{ background: '#2d2d2d', boxShadow: '0 8px 24px rgb(0 0 0 / 0.5)', maxHeight: 260 }}
          >
            {groups.map((group) => (
              <div key={group.mfgName}>
                <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7280' }}>
                  {group.mfgName}
                </div>
                {group.colors.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onChange(String(c.id)); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-iron-700/40 transition-colors"
                    style={{ color: '#ffffff' }}
                  >
                    <span style={{ width: 16, height: 16, borderRadius: '50%', background: c.hex, border: `2px solid ${c.hex}`, flexShrink: 0, display: 'inline-block' }} />
                    {c.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={onAdd} disabled={!value} className="btn-secondary btn-sm">Add</button>
    </div>
  );
}

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
  const { categories } = useCategories();
  const { create, update, isCreating, isUpdating } = useProducts();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductFormFields>();

  const skuManuallyEdited = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [skuLoading, setSkuLoading] = useState(false);

  // Color+weight state for product
  const [colorWeights, setColorWeights] = useState<ColorWeightEntry[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string>('');

  // Image state
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const watchedName = watch('name', '');

  useEffect(() => {
    if (existing) {
      const isCopy = existing.name.startsWith('Copy of ');
      skuManuallyEdited.current = !!existing.sku && !isCopy;
      reset({
        name: existing.name,
        description: existing.description || '',
        sku: isCopy ? '' : (existing.sku || ''),
        unitPrice: existing.unitPrice,
        active: existing.active,
        publishedToStore: existing.publishedToStore,
        categoryId: existing.categoryId ?? null,
        storeTitle: existing.storeTitle || '',
        storeDescription: existing.storeDescription || '',
        wholesalePrice: existing.wholesalePrice ?? 0,
        retailPrice: existing.retailPrice ?? 0,
      });
      if (existing.colors && existing.colors.length > 0) {
        setColorWeights(
          existing.colors.map((pc) => ({
            colorId: pc.colorId,
            weightGrams: String(pc.weightGrams),
            sortOrder: pc.sortOrder,
          })),
        );
      }
      if (existing.images) {
        setImages(existing.images);
      }
    }
  }, [existing, reset]);

  // Debounced SKU suggestion on name change
  useEffect(() => {
    if (!watchedName || skuManuallyEdited.current) return;
    if (watchedName.startsWith('Copy of ')) return; // wait until user renames it
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

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || !isEdit) return;
    setUploadingImage(true);
    try {
      for (const file of Array.from(files)) {
        const img = await productApi.uploadImage(productId, file);
        setImages((prev) => [...prev, img]);
      }
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleSetPrimary = async (imageId: number) => {
    await productApi.setPrimaryImage(productId, imageId);
    setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === imageId })));
  };

  const handleDeleteImage = async (imageId: number) => {
    await productApi.deleteImage(productId, imageId);
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  };

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
  const labelClass = 'block text-sm font-medium mb-1 text-primary-400';

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
              {skuLoading && <span className="ml-2 text-xs text-white">generating…</span>}
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
            <p className="text-xs text-white mt-1">Auto-generated from name. Edit to override.</p>
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
            <label htmlFor="active" className="text-sm font-medium text-primary-400">
              Active (available for use in invoices)
            </label>
          </div>
        </div>

        {/* Filament Colors + Weights */}
        <div className="card space-y-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#ff9900' }}>Filament Colors &amp; Weights</h3>
            <p className="text-xs text-white mt-0.5">
              Enter per-color filament usage from your slicer (in grams per print).
              {totalGrams > 0 && (
                <span className="ml-2 font-semibold" style={{ color: '#ff9900' }}>
                  Total: {totalGrams.toFixed(2)}g
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
                    border: `2px solid ${color.hex}`,
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
                <span className="text-sm text-white flex-1 min-w-0 truncate">{color.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.weightGrams}
                    onChange={(e) => updateWeight(entry.colorId, e.target.value)}
                    className="w-20 px-2 py-1 rounded text-iron-50 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-right"
                    style={inputSt}
                  />
                  <span className="text-xs text-white">g</span>
                  <button
                    type="button"
                    onClick={() => removeColor(entry.colorId)}
                    className="text-white hover:text-red-400 transition-colors ml-1 text-sm leading-none"
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
            <ColorDropdown
              colors={remainingColors}
              value={selectedColorId}
              onChange={setSelectedColorId}
              onAdd={addColor}
            />
          )}

          {colorWeights.length === 0 && (
            <p className="text-xs text-white italic">No colors assigned. Add colors to enable filament weight tracking.</p>
          )}
        </div>

        {/* Store Listing */}
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: '#ff9900' }}>Store Listing</h3>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                {...register('publishedToStore')}
                className="h-4 w-4 rounded accent-primary-500"
              />
              <span className="text-sm font-medium" style={{ color: '#ff9900' }}>Published to store</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Wholesale Price ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                {...register('wholesalePrice', { valueAsNumber: true, min: 0 })}
                className={fieldClass}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelClass}>Retail Price ($)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                {...register('retailPrice', { valueAsNumber: true, min: 0 })}
                className={fieldClass}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Category</label>
            <select
              {...register('categoryId', { setValueAs: (v) => v === '' ? null : parseInt(v) })}
              className={fieldClass}
              style={{ background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)', border: 'none', boxShadow: 'inset 0 2px 4px rgb(0 0 0 / 0.4)' }}
            >
              <option value="">— No category —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Store Title</label>
            <input
              {...register('storeTitle')}
              className={fieldClass}
              placeholder="Public display name (leave blank to use product name)"
            />
          </div>

          <div>
            <label className={labelClass}>Store Description</label>
            <textarea
              {...register('storeDescription')}
              rows={4}
              className={`${fieldClass} resize-none`}
              placeholder="Public-facing description shown to customers…"
            />
          </div>
        </div>

        {/* Product Images — edit mode only */}
        {isEdit && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: '#ff9900' }}>Product Images</h3>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="btn-secondary btn-sm"
              >
                {uploadingImage ? 'Uploading…' : '+ Upload Image'}
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleImageUpload(e.target.files)}
              />
            </div>

            {images.length === 0 ? (
              <p className="text-xs text-iron-400 italic">No images yet. Upload JPEG, PNG, or WEBP files (max 5 MB each).</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images
                  .slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
                  .map((img) => (
                    <div
                      key={img.id}
                      className="relative rounded-lg overflow-hidden group"
                      style={{
                        aspectRatio: '1',
                        background: '#2d2d2d',
                        border: img.isPrimary ? '2px solid #ff9900' : '2px solid transparent',
                      }}
                    >
                      <img
                        src={img.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {img.isPrimary && (
                        <span
                          className="absolute top-1 left-1 text-xs font-bold px-1.5 py-0.5 rounded"
                          style={{ background: '#ff9900', color: '#0a0a0a' }}
                        >
                          Primary
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                        {!img.isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(img.id)}
                            className="btn-secondary btn-sm w-full text-xs"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(img.id)}
                          className="btn-danger btn-sm w-full text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            {!isEdit && (
              <p className="text-xs text-iron-400 italic">Save the product first, then upload images.</p>
            )}
          </div>
        )}

        {!isEdit && (
          <div className="card" style={{ background: 'linear-gradient(to bottom, #2d2d2d, #3a3a3a)', borderColor: '#3a3a3a' }}>
            <p className="text-xs text-iron-400 italic text-center py-2">
              Image upload available after saving the product.
            </p>
          </div>
        )}

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
