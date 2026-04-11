import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PrinterLiveStatus } from '@wizqueue/shared';

export function usePrinterDashboard() {
  const [liveStatuses, setLiveStatuses] = useState<PrinterLiveStatus[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track previous gcode state per printer so we can detect transitions
  const prevStates = useRef<Record<number, string | null>>({});
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function connect() {
      try {
        const res = await fetch('/api/bambu/events', {
          credentials: 'include',
          signal: controller.signal,
          headers: { Accept: 'text/event-stream' },
        });

        if (!res.ok || !res.body) throw new Error(`SSE connect failed: ${res.status}`);
        setError(null);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (active) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // Process complete SSE lines
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const parsed: PrinterLiveStatus[] = JSON.parse(line.slice(6));
              setLiveStatuses(parsed);

              // Detect state transitions that affect queue item statuses.
              // The backend (bambu-monitor) has already called inhouse-transition
              // before broadcasting the SSE event, so the DB is already updated.
              let queueInvalidated = false;
              for (const printer of parsed) {
                const prev = prevStates.current[printer.printerId] ?? null;
                const curr = printer.gcodeState ?? null;
                if (curr !== prev) {
                  // RUNNING: pending → printing transition may have happened
                  // FINISH/FAILED/IDLE after RUNNING: printing → completed may have happened
                  if (
                    curr === 'RUNNING' ||
                    (prev === 'RUNNING' && (curr === 'FINISH' || curr === 'FAILED' || curr === 'IDLE'))
                  ) {
                    if (!queueInvalidated) {
                      queryClient.invalidateQueries({ queryKey: ['queue'] });
                      queueInvalidated = true;
                    }
                  }
                  prevStates.current[printer.printerId] = curr;
                }
              }
            } catch {
              // ignore malformed event
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || !active) return;
        setError(err);
        setLiveStatuses([]);
        // Reconnect after 3s
        retryTimer.current = setTimeout(() => { if (active) connect(); }, 3000);
      }
    }

    connect();

    return () => {
      active = false;
      controller.abort();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [queryClient]);

  return { liveStatuses, error };
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
