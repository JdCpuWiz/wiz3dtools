export interface Manufacturer {
  id: number;
  name: string;
  emptySpoolWeightG: number;
  fullSpoolNetWeightG: number;
  lowThresholdG: number;
  criticalThresholdG: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateManufacturerDto {
  name: string;
  emptySpoolWeightG: number;
  fullSpoolNetWeightG: number;
  lowThresholdG?: number;
  criticalThresholdG?: number;
}

export interface UpdateManufacturerDto {
  name?: string;
  emptySpoolWeightG?: number;
  fullSpoolNetWeightG?: number;
  lowThresholdG?: number;
  criticalThresholdG?: number;
}

export interface Color {
  id: number;
  name: string;
  hex: string;
  // Filament material (e.g. "PLA", "PLA Basic", "PLA-CF", "PETG-HF",
  // "ABS"). Used by the admin /colors filter + dedupe family check.
  // NULL on manually-created rows that pre-date the BamBuddy sync.
  material: string | null;
  // BamBuddy color id when this row is linked to BamBuddy's catalog.
  // NULL on manually-created or unlinked rows. Drives the dedupe
  // tool's "can't delete linked rows" safety guard.
  bambuddyId: number | null;
  // Multi-color filament support (migration 039 / Bug #66 follow-up).
  // `isMultiColor=true` rows carry their secondary hex(es) in
  // `additionalHexes` (empty array for solid-color rows).
  isMultiColor: boolean;
  additionalHexes: string[];
  active: boolean;
  sortOrder: number;
  manufacturerId: number | null;
  manufacturer: Manufacturer | null;
  inventoryGrams: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItemColor {
  id: number;
  colorId: number;
  color: Color;
  isPrimary: boolean;
  note: string | null;
  sortOrder: number;
  weightGrams: number;
}

export interface ItemColorDto {
  colorId: number;
  isPrimary: boolean;
  note?: string | null;
  sortOrder: number;
  weightGrams?: number;
}

export interface CreateColorDto {
  name: string;
  hex: string;
  material?: string | null;
  isMultiColor?: boolean;
  additionalHexes?: string[];
  active?: boolean;
  sortOrder?: number;
  manufacturerId?: number | null;
  inventoryGrams?: number;
}

export interface UpdateColorDto {
  name?: string;
  hex?: string;
  material?: string | null;
  isMultiColor?: boolean;
  additionalHexes?: string[];
  active?: boolean;
  sortOrder?: number;
  manufacturerId?: number | null;
  inventoryGrams?: number;
}
