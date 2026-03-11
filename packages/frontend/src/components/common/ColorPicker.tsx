import React from 'react';
import type { Color, ItemColorDto } from '@wizqueue/shared';

interface ColorPickerProps {
  availableColors: Color[];
  selected: ItemColorDto[];
  onChange: (colors: ItemColorDto[]) => void;
  maxColors?: number;
}

export const ColorSwatch: React.FC<{ hex: string; name: string; size?: number }> = ({
  hex,
  name,
  size = 20,
}) => (
  <span
    title={name}
    style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: hex,
      border: '2px solid rgba(255,255,255,0.15)',
      flexShrink: 0,
    }}
  />
);

export const ColorPicker: React.FC<ColorPickerProps> = ({
  availableColors,
  selected,
  onChange,
  maxColors = 4,
}) => {
  const activeColors = availableColors.filter((c) => c.active);

  const addColor = (colorId: number) => {
    if (selected.length >= maxColors) return;
    if (selected.some((s) => s.colorId === colorId)) return;
    const isPrimary = selected.length === 0;
    onChange([
      ...selected,
      { colorId, isPrimary, note: null, sortOrder: selected.length },
    ]);
  };

  const removeColor = (colorId: number) => {
    const next = selected
      .filter((s) => s.colorId !== colorId)
      .map((s, i) => ({ ...s, sortOrder: i }));
    // If we removed the primary, make first one primary
    if (next.length > 0 && !next.some((s) => s.isPrimary)) {
      next[0] = { ...next[0], isPrimary: true };
    }
    onChange(next);
  };

  const setPrimary = (colorId: number) => {
    onChange(selected.map((s) => ({ ...s, isPrimary: s.colorId === colorId })));
  };

  const setNote = (colorId: number, note: string) => {
    onChange(selected.map((s) => (s.colorId === colorId ? { ...s, note: note || null } : s)));
  };

  const isSelected = (colorId: number) => selected.some((s) => s.colorId === colorId);

  return (
    <div>
      {/* Palette */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {activeColors.map((c) => {
          const sel = isSelected(c.id);
          return (
            <button
              key={c.id}
              type="button"
              title={sel ? `Remove ${c.name}` : `Add ${c.name}`}
              onClick={() => (sel ? removeColor(c.id) : addColor(c.id))}
              disabled={!sel && selected.length >= maxColors}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px 3px 4px',
                borderRadius: 99,
                border: sel ? '2px solid #ff9900' : '2px solid #3a3a3a',
                background: sel ? 'rgba(255,153,0,0.12)' : 'rgba(45,45,45,0.8)',
                cursor: !sel && selected.length >= maxColors ? 'not-allowed' : 'pointer',
                opacity: !sel && selected.length >= maxColors ? 0.4 : 1,
                transition: 'border-color 0.15s',
              }}
            >
              <ColorSwatch hex={c.hex} name={c.name} size={16} />
              <span style={{ fontSize: 11, color: sel ? '#ff9900' : '#d1d5db', fontWeight: sel ? 600 : 400 }}>
                {c.name}
              </span>
            </button>
          );
        })}
        {activeColors.length === 0 && (
          <span style={{ fontSize: 12, color: '#6b7280' }}>No colors in catalog — add some in Admin → Colors</span>
        )}
      </div>

      {/* Selected colors with note inputs */}
      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((s) => {
            const color = availableColors.find((c) => c.id === s.colorId);
            if (!color) return null;
            return (
              <div
                key={s.colorId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: s.isPrimary ? 'rgba(255,153,0,0.08)' : 'rgba(45,45,45,0.6)',
                  border: s.isPrimary ? '1px solid rgba(255,153,0,0.3)' : '1px solid #2d2d2d',
                }}
              >
                <ColorSwatch hex={color.hex} name={color.name} size={18} />
                <span style={{ fontSize: 12, color: '#e5e5e5', minWidth: 70 }}>{color.name}</span>
                <button
                  type="button"
                  onClick={() => setPrimary(s.colorId)}
                  title={s.isPrimary ? 'Primary color' : 'Set as primary'}
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 99,
                    border: 'none',
                    background: s.isPrimary ? '#ff9900' : 'rgba(255,153,0,0.15)',
                    color: s.isPrimary ? '#0a0a0a' : '#ff9900',
                    cursor: 'pointer',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.isPrimary ? 'Primary' : 'Set Primary'}
                </button>
                <input
                  type="text"
                  value={s.note || ''}
                  onChange={(e) => setNote(s.colorId, e.target.value)}
                  placeholder="short note (e.g. body, eyes)"
                  maxLength={60}
                  style={{
                    flex: 1,
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'rgba(10,10,10,0.5)',
                    boxShadow: 'inset 0 1px 3px rgb(0 0 0 / 0.4)',
                    color: '#e5e5e5',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeColor(s.colorId)}
                  style={{ color: '#6b7280', fontSize: 16, lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none', padding: '0 2px' }}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
