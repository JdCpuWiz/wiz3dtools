export interface Printer {
  id: number;
  name: string;
  model: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface CreatePrinterDto {
  name: string;
  model?: string;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdatePrinterDto {
  name?: string;
  model?: string;
  active?: boolean;
  sortOrder?: number;
}
