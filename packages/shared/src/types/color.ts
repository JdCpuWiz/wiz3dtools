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
  isMultiColor?: boolean;
  additionalHexes?: string[];
  active?: boolean;
  sortOrder?: number;
  manufacturerId?: number | null;
  inventoryGrams?: number;
}
