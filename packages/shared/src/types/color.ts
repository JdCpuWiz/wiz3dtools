export interface Color {
  id: number;
  name: string;
  hex: string;
  active: boolean;
  sortOrder: number;
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
}

export interface ItemColorDto {
  colorId: number;
  isPrimary: boolean;
  note?: string | null;
  sortOrder: number;
}

export interface CreateColorDto {
  name: string;
  hex: string;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdateColorDto {
  name?: string;
  hex?: string;
  active?: boolean;
  sortOrder?: number;
}
