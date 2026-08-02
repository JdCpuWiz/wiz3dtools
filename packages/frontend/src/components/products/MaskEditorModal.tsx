import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Modal } from '../common/Modal';
import { productApi } from '../../services/api';
import {
  compositeColors,
  compositeOverlay,
  loadImage,
  OVERLAY_TINTS,
  type SlotMaskImage,
} from '../../lib/compositor';
import type { ProductImage, ProductImageMask } from '@wizqueue/shared';

interface SlotInfo {
  slotIndex: number;
  colorName: string;
  hex: string;
}

interface MaskEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  image: ProductImage;
  /** Recipe slots in sortOrder, resolved against the color catalog. */
  slots: SlotInfo[];
  /** Bubble mask changes up so the tile badges stay accurate. */
  onMasksChange: (imageId: number, masks: ProductImageMask[]) => void;
}

/**
 * BP17 Phase 4 — upload-only mask editor for multi-color products.
 * Left: live canvas — either the slot-assignment overlay (each mask tinted a
 * distinct color) or the Test-Colors sandbox (the real storefront composite).
 * Right: one row per recipe slot with upload / replace / remove.
 */
export const MaskEditorModal: React.FC<MaskEditorModalProps> = ({
  isOpen,
  onClose,
  productId,
  image,
  slots,
  onMasksChange,
}) => {
  const [masks, setMasks] = useState<ProductImageMask[]>(image.masks ?? []);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({});
  const [mode, setMode] = useState<'overlay' | 'test'>('overlay');
  const [testColors, setTestColors] = useState<Map<number, string>>(
    () => new Map(slots.map((s) => [s.slotIndex, s.hex])),
  );
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseImgRef = useRef<HTMLImageElement | null>(null);
  const maskImgsRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSlotRef = useRef<number>(0);

  useEffect(() => {
    setMasks(image.masks ?? []);
    maskImgsRef.current = new Map();
    baseImgRef.current = null;
    setSlotErrors({});
    setLoadError(null);
  }, [image.id, isOpen]);

  // (Re)load base + mask bitmaps whenever the mask set changes, then render.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        if (!baseImgRef.current) baseImgRef.current = await loadImage(image.url);
        const loaded = new Map<number, HTMLImageElement>();
        for (const m of masks) {
          loaded.set(m.slotIndex, await loadImage(m.url));
        }
        if (cancelled) return;
        maskImgsRef.current = loaded;
        setLoadError(null);
        render();
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load images');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, image.url, masks]);

  // Re-render on mode / color changes (bitmaps already decoded — pure CPU).
  useEffect(() => {
    if (isOpen && baseImgRef.current) render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, testColors]);

  const render = () => {
    const canvas = canvasRef.current;
    const base = baseImgRef.current;
    if (!canvas || !base) return;
    const slotMasks: SlotMaskImage[] = [...maskImgsRef.current.entries()]
      .map(([slotIndex, img]) => ({ slotIndex, image: img }))
      .sort((a, b) => a.slotIndex - b.slotIndex);
    const ms = mode === 'overlay'
      ? compositeOverlay(canvas, base, slotMasks)
      : compositeColors(canvas, base, slotMasks, testColors);
    setRenderMs(ms);
  };

  const pickFile = (slotIndex: number) => {
    uploadSlotRef.current = slotIndex;
    fileInputRef.current?.click();
  };

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    const slotIndex = uploadSlotRef.current;
    setBusySlot(slotIndex);
    setSlotErrors((prev) => { const next = { ...prev }; delete next[slotIndex]; return next; });
    try {
      const mask = await productApi.uploadImageMask(productId, image.id, slotIndex, file);
      setMasks((prev) => {
        const next = [...prev.filter((m) => m.slotIndex !== slotIndex), mask]
          .sort((a, b) => a.slotIndex - b.slotIndex);
        onMasksChange(image.id, next);
        return next;
      });
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? err.message)
        : 'Upload failed';
      setSlotErrors((prev) => ({ ...prev, [slotIndex]: message }));
    } finally {
      setBusySlot(null);
    }
  };

  const handleRemove = async (slotIndex: number) => {
    setBusySlot(slotIndex);
    try {
      await productApi.deleteImageMask(productId, image.id, slotIndex);
      setMasks((prev) => {
        const next = prev.filter((m) => m.slotIndex !== slotIndex);
        onMasksChange(image.id, next);
        return next;
      });
    } catch {
      setSlotErrors((prev) => ({ ...prev, [slotIndex]: 'Failed to remove mask' }));
    } finally {
      setBusySlot(null);
    }
  };

  const maskBySlot = useMemo(
    () => new Map(masks.map((m) => [m.slotIndex, m])),
    [masks],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Color Masks" wide>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />
      <div className="flex flex-col md:flex-row gap-5">
        {/* Preview canvas */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('overlay')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={mode === 'overlay'
                ? { background: '#ff9900', color: '#0a0a0a' }
                : { background: '#2d2d2d', color: '#f0f1f4' }}
            >
              Slot Overlay
            </button>
            <button
              type="button"
              onClick={() => setMode('test')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={mode === 'test'
                ? { background: '#ff9900', color: '#0a0a0a' }
                : { background: '#2d2d2d', color: '#f0f1f4' }}
            >
              Test Colors
            </button>
            {renderMs !== null && (
              <span className="text-xs ml-auto" style={{ color: '#ff9900', fontVariantNumeric: 'tabular-nums' }}>
                {renderMs.toFixed(1)} ms
              </span>
            )}
          </div>
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg"
            style={{ background: '#1a1a1a', maxHeight: '55vh', objectFit: 'contain' }}
          />
          {loadError && (
            <p className="text-xs px-2 py-1 rounded" style={{ background: '#b91c1c', color: '#ffffff' }}>{loadError}</p>
          )}
          {mode === 'test' && (
            <div className="flex flex-wrap gap-3">
              {slots.map((s) => (
                <label key={s.slotIndex} className="flex items-center gap-1.5 text-xs text-iron-50">
                  Slot {s.slotIndex + 1}
                  <input
                    type="color"
                    value={testColors.get(s.slotIndex) ?? s.hex}
                    onChange={(e) => setTestColors((prev) => new Map(prev).set(s.slotIndex, e.target.value))}
                    className="h-6 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                </label>
              ))}
              <span className="text-xs text-iron-400 self-center">
                Defaults are the recipe colors — try wild combos to stress the masks.
              </span>
            </div>
          )}
        </div>

        {/* Slot rows */}
        <div className="md:w-80 space-y-2">
          {slots.map((s) => {
            const mask = maskBySlot.get(s.slotIndex);
            return (
              <div key={s.slotIndex} className="rounded-lg p-3 space-y-2" style={{ background: '#2d2d2d' }}>
                <div className="flex items-center gap-2 text-xs text-iron-50">
                  <span
                    className="inline-block w-3.5 h-3.5 rounded-sm shrink-0"
                    style={{
                      background: OVERLAY_TINTS[s.slotIndex % OVERLAY_TINTS.length],
                    }}
                    title="Overlay tint for this slot"
                  />
                  <span className="font-semibold">Slot {s.slotIndex + 1}</span>
                  <span
                    className="inline-block w-3 h-3 rounded-full border shrink-0"
                    style={{ background: s.hex, borderColor: '#4a4a4a' }}
                  />
                  <span className="truncate">{s.colorName}</span>
                  <span
                    className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
                    style={mask
                      ? { background: mask.source === 'MANUAL_UPLOAD' ? '#1d4ed8' : '#15803d', color: '#ffffff' }
                      : { background: '#4b5563', color: '#ffffff' }}
                  >
                    {mask ? (mask.source === 'MANUAL_UPLOAD' ? 'MANUAL' : 'AUTO') : 'NO MASK'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => pickFile(s.slotIndex)}
                    disabled={busySlot !== null}
                    className="btn-secondary btn-sm flex-1 text-xs"
                  >
                    {busySlot === s.slotIndex ? 'Working…' : mask ? 'Replace PNG' : 'Upload PNG'}
                  </button>
                  {mask && (
                    <button
                      type="button"
                      onClick={() => handleRemove(s.slotIndex)}
                      disabled={busySlot !== null}
                      className="btn-danger btn-sm text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {slotErrors[s.slotIndex] && (
                  <p className="text-xs px-2 py-1 rounded" style={{ background: '#b91c1c', color: '#ffffff' }}>
                    {slotErrors[s.slotIndex]}
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-xs text-iron-400">
            Masks are PNGs with transparency — the painted (opaque) area is where
            that slot's color applies. Replaced masks are kept for 30 days.
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="btn-primary btn-sm">Done</button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
