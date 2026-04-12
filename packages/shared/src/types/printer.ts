export interface Printer {
  id: number;
  name: string;
  model: string | null;
  active: boolean;
  sortOrder: number;
  ipAddress: string | null;
  serialNumber: string | null;
  badgeColor: string | null;
  // accessCode is write-only — never returned in API responses
  createdAt: string;
}

export interface CreatePrinterDto {
  name: string;
  model?: string;
  active?: boolean;
  sortOrder?: number;
  ipAddress?: string;
  serialNumber?: string;
  accessCode?: string;
  badgeColor?: string;
}

export interface UpdatePrinterDto {
  name?: string;
  model?: string;
  active?: boolean;
  sortOrder?: number;
  ipAddress?: string;
  serialNumber?: string;
  accessCode?: string;
  badgeColor?: string;
}

export interface FilamentJob {
  id: number;
  printerId: number | null;
  printerName: string | null;
  jobName: string | null;
  amsSlotId: string | null;
  amsColorHex: string | null;
  amsMaterial: string | null;
  remainStart: number | null;
  remainEnd: number | null;
  filamentGrams: number | null;
  colorId: number | null;
  colorName: string | null;
  colorHex: string | null;
  queueItemId: number | null;
  status: 'pending' | 'auto_resolved' | 'resolved' | 'skipped';
  createdAt: string;
  resolvedAt: string | null;
}

export interface ResolveFilamentJobDto {
  colorId: number;
}

// Live printer status from bambu-monitor service
export interface PrinterLiveStatus {
  printerId: number;
  printerName: string;
  serial: string;
  connected: boolean;
  gcodeState: string | null;       // IDLE | RUNNING | PAUSE | FINISH | FAILED
  mcPercent: number | null;
  mcRemainingTime: number | null;  // minutes (Bambu MQTT mc_remaining_time)
  layerNum: number | null;
  totalLayerNum: number | null;
  subtaskName: string | null;
  nozzleTemper: number | null;
  bedTemper: number | null;
  chamberTemper: number | null;
  spdMag: number | null;           // print speed %
  amsSlots: AmsSlot[];
  lastUpdated: string | null;
}

export interface AmsSlot {
  amsId: number;
  trayId: number;
  remain: number | null;          // % remaining
  trayColor: string | null;       // hex RRGGBBAA from RFID
  trayType: string | null;        // "PLA", "PETG", etc.
  traySubBrands: string | null;   // "Bambu", etc.
}
