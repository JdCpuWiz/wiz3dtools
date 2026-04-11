import { useQuery } from '@tanstack/react-query';
import { bambuApi } from '../services/api';
import type { PrinterLiveStatus } from '@wizqueue/shared';

export function usePrinterDashboard() {
  const { data: liveStatuses = [], isLoading, error } = useQuery({
    queryKey: ['bambu-live'],
    queryFn: bambuApi.getLiveStatus,
    refetchInterval: 5_000,
    retry: false,
  });

  return { liveStatuses, isLoading, error };
}

// Format seconds to "Xh Ym" or "Ym" or "< 1m"
export function formatTimeRemaining(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return '< 1m';
}

// Map gcode_state to a display label and color
export function getPrinterStatusStyle(state: PrinterLiveStatus): {
  label: string;
  bg: string;
  text: string;
} {
  if (!state.connected) return { label: 'Offline', bg: '#6b7280', text: '#ffffff' };
  switch (state.gcodeState) {
    case 'RUNNING': return { label: 'Printing',  bg: '#15803d', text: '#ffffff' };
    case 'PAUSE':   return { label: 'Paused',    bg: '#eab308', text: '#000000' };
    case 'FINISH':  return { label: 'Finished',  bg: '#1d4ed8', text: '#ffffff' };
    case 'FAILED':  return { label: 'Failed',    bg: '#b91c1c', text: '#ffffff' };
    case 'IDLE':
    default:        return { label: 'Idle',      bg: '#4b5563', text: '#ffffff' };
  }
}
