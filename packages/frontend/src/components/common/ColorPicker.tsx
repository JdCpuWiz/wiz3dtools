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
      border: '2px solid #444444',
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

  // Group active colors by manufacturer (order preserved from API: mfg name asc, color name asc)
  const groups: { mfgName: string; colors: Color[] }[] = [];
  for (const c of activeColors) {
    const mfgName = c.manufacturer?.name ?? 'No Manufacturer';
    const existing = groups.find((g) => g.mfgName === mfgName);
    if (existing) existing.colors.push(c);
    else groups.push({ mfgName, colors: [c] });
  }

  return (
    <div>
      {/* Palette grouped by manufacturer */}
      <div className="mb-3 space-y-2">
        {groups.map((group) => (
          <div key={group.mfgName}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {group.mfgName}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.colors.map((c) => {
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
                      background: sel ? '#3a1f00' : '#2d2d2d',
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
            </div>
          </div>
        ))}
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
                  background: s.isPrimary ? '#3a1f00' : '#2d2d2d',
                  border: s.isPrimary ? '1px solid #b45309' : '1px solid #3a3a3a',
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
                    background: s.isPrimary ? '#ff9900' : '#3a1f00',
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
