import React, { useState } from 'react';
import { usePrinterDashboard, formatTimeRemaining, getPrinterStatusStyle } from '../../hooks/usePrinterDashboard';
import { PageIcon } from '../common/PageIcon';
import { useFilamentJobs, useLastPrinterJob } from '../../hooks/useFilamentJobs';
import { usePrinters } from '../../hooks/usePrinters';
import { useColors } from '../../hooks/useColors';
import { useQueue } from '../../hooks/useQueue';
import type { PrinterLiveStatus, FilamentJob, Printer, QueueItem } from '@wizqueue/shared';

// ── Printer Card ───────────────────────────────────────────────────────────────

function FilamentSummary({ jobs }: { jobs: FilamentJob[] }) {
  if (jobs.length === 0) return null;
  const jobName = jobs[0].jobName;
  const totalGrams = jobs.reduce((s, j) => s + (j.filamentGrams ?? 0), 0);
  return (
    <div className="border-t pt-3 mt-1" style={{ borderColor: '#2d2d2d' }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#ff9900' }}>Last Print</p>
      {jobName && <p className="text-xs text-white truncate mb-2">{jobName}</p>}
      <div className="space-y-1">
        {jobs.map((j) => (
          <div key={j.id} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{
                background: j.colorHex ? `#${j.colorHex}` : (j.amsColorHex ? `#${j.amsColorHex.slice(0, 6)}` : '#4b5563'),
                border: `1px solid ${j.colorHex ? `#${j.colorHex}` : '#4b5563'}`,
              }}
            />
            <span className="text-white flex-1 truncate">
              {j.colorName ?? (j.amsColorHex ? `#${j.amsColorHex.slice(0, 6).toUpperCase()}` : 'Unknown')}
              {j.amsMaterial && <span className="text-white ml-1">({j.amsMaterial})</span>}
            </span>
            {j.filamentGrams !== null && j.filamentGrams > 0 && (
              <span className="text-white shrink-0 font-medium">{j.filamentGrams.toFixed(1)}g</span>
            )}
          </div>
        ))}
      </div>
      {totalGrams > 0 && (
        <div className="flex justify-between mt-2 pt-1 border-t" style={{ borderColor: '#3a3a3a' }}>
          <span className="text-xs font-semibold" style={{ color: '#ff9900' }}>Total</span>
          <span className="text-xs font-semibold" style={{ color: '#ff9900' }}>{totalGrams.toFixed(1)}g</span>
        </div>
      )}
    </div>
  );
}

function PrinterCard({
  status,
  printer,
  monitorOnline,
}: {
  status: PrinterLiveStatus | null;
  printer: Printer;
  monitorOnline: boolean;
}) {
  const hasBambuConfig = !!(printer.ipAddress && printer.serialNumber);
  const lastJob = useLastPrinterJob(printer.name);

  const style = status
    ? getPrinterStatusStyle(status)
    : !hasBambuConfig
      ? { label: 'No Bambu Config', bg: '#4b5563', text: '#ffffff' }
      : !monitorOnline
        ? { label: 'Monitor Offline', bg: '#b91c1c', text: '#ffffff' }
        : { label: 'Connecting…', bg: '#6b7280', text: '#ffffff' };

  const isRunning = status?.gcodeState === 'RUNNING';

  return (
    <div className="card flex flex-col gap-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="px-2 py-0.5 rounded text-sm font-bold"
          style={{ background: printer.badgeColor || '#4b5563', color: '#ffffff' }}
        >
          {printer.name}
        </span>
        <span
          className="px-2 py-0.5 rounded text-xs font-semibold"
          style={{ background: style.bg, color: style.text }}
        >
          {style.label}
        </span>
      </div>

      {/* Stats grid */}
      {status?.connected ? (
        <div className="grid grid-cols-2 gap-3">
          {/* Progress */}
          <div className="card-surface rounded p-3 col-span-2">
            <div className="flex justify-between text-xs text-white mb-1">
              <span>{status.subtaskName || 'No job'}</span>
              <span>{status.mcPercent !== null ? `${status.mcPercent}%` : '—'}</span>
            </div>
            <div className="w-full rounded-full h-2" style={{ background: '#2d2d2d' }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${status.mcPercent ?? 0}%`,
                  background: isRunning ? '#ff9900' : '#4b5563',
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-white mt-1">
              <span>
                {status.layerNum !== null && status.totalLayerNum !== null
                  ? `Layer ${status.layerNum} / ${status.totalLayerNum}`
                  : 'Layer —'}
              </span>
              <span>⏱ {formatTimeRemaining(status.mcRemainingTime)} remaining</span>
            </div>
          </div>

          {/* Temps */}
          <StatPill label="Nozzle" value={status.nozzleTemper !== null ? `${status.nozzleTemper.toFixed(0)}°C` : '—'} />
          <StatPill label="Bed"    value={status.bedTemper    !== null ? `${status.bedTemper.toFixed(0)}°C`    : '—'} />
          <StatPill label="Chamber" value={status.chamberTemper !== null ? `${status.chamberTemper.toFixed(0)}°C` : '—'} />
          <StatPill label="Speed"   value={status.spdMag !== null ? `${status.spdMag}%` : '—'} />

          {/* AMS slots */}
          {status.amsSlots.length > 0 && (
            <div className="col-span-2">
              <p className="text-xs font-semibold mb-2" style={{ color: '#ff9900' }}>AMS Filament</p>
              <div className="grid grid-cols-4 gap-1">
                {status.amsSlots.map((slot) => (
                  <div
                    key={`${slot.amsId}.${slot.trayId}`}
                    className="rounded p-1.5 flex flex-col items-center gap-1"
                    style={{ background: '#2d2d2d' }}
                  >
                    <div
                      className="w-5 h-5 rounded-full border-2"
                      style={{
                        background: slot.trayColor ? `#${slot.trayColor.slice(0, 6)}` : '#444',
                        borderColor: slot.trayColor ? `#${slot.trayColor.slice(0, 6)}` : '#444',
                      }}
                    />
                    <span className="text-xs text-white">{slot.remain !== null && slot.remain >= 0 ? `${slot.remain}%` : '—'}</span>
                    <span className="text-xs font-semibold truncate w-full text-center" style={{ color: '#ff9900' }}>{slot.trayType || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-white text-sm text-center py-4">
          {!hasBambuConfig
            ? 'Set IP, serial, and access code in Admin → Printers to enable monitoring.'
            : !monitorOnline
              ? 'Bambu monitor service is offline. Check container logs.'
              : 'Establishing MQTT connection… LAN Mode must be enabled on the printer.'}
        </p>
      )}

      {/* Print failed notice — connected but last job errored */}
      {status?.connected && status.gcodeState === 'FAILED' && (
        <p className="text-xs text-center text-white">
          Last print job failed.{status.subtaskName ? ` (${status.subtaskName})` : ''} Start a new print to clear.
        </p>
      )}

      <FilamentSummary jobs={lastJob} />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface rounded p-2 flex flex-col items-center">
      <span className="text-xs font-semibold" style={{ color: '#ff9900' }}>{label}</span>
      <span className="text-sm font-semibold text-white mt-0.5">{value}</span>
    </div>
  );
}

// ── Printer Queue Card ─────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: 'Pending',   bg: '#6b7280', color: '#ffffff' },
  printing:  { label: 'Printing',  bg: '#ff9900', color: '#0a0a0a' },
  completed: { label: 'Done',      bg: '#15803d', color: '#ffffff' },
  cancelled: { label: 'Cancelled', bg: '#b91c1c', color: '#ffffff' },
};

function PrinterQueueCard({ printerName, items }: { printerName: string; items: QueueItem[] }) {
  const active = items.filter((i) => i.status !== 'completed' && i.status !== 'cancelled');

  if (active.length === 0) {
    return (
      <div className="card-surface rounded p-3 text-center text-xs text-white">
        No items queued for {printerName}
      </div>
    );
  }

  return (
    <div className="card-surface rounded" style={{ overflow: 'hidden' }}>
      <div className="px-3 py-2 border-b border-[#2d2d2d] flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#ff9900' }}>Queue</span>
        <span className="text-xs text-white">{active.length} item{active.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-[#2d2d2d]">
        {active.map((item) => {
          const s = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending;
          return (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2">
              <span
                className="px-1.5 py-0.5 rounded text-xs font-semibold shrink-0"
                style={{ background: s.bg, color: s.color }}
              >
                {s.label}
              </span>
              <span className="text-sm text-white truncate flex-1">{item.productName}</span>
              {item.quantity > 1 && (
                <span className="text-xs text-white shrink-0">×{item.quantity}</span>
              )}
              {item.isInhouse && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: '#1d4ed8', color: '#ffffff' }}
                >
                  In-house
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Filament Jobs Panel ────────────────────────────────────────────────────────

function FilamentJobsPanel() {
  const { jobs, pendingCount, resolve, skip, isResolving } = useFilamentJobs('pending');
  const { colors } = useColors();
  const [selectedColors, setSelectedColors] = useState<Record<number, number>>({});

  if (pendingCount === 0) return null;

  return (
    <div className="card border" style={{ borderColor: '#eab308', borderWidth: 1 }}>
      <div className="flex items-center gap-2 mb-4">
        <span
          className="px-2 py-0.5 rounded text-xs font-bold"
          style={{ background: '#eab308', color: '#000' }}
        >
          {pendingCount} PENDING
        </span>
        <h3 className="text-base font-bold text-white">Filament Attribution Needed</h3>
      </div>
      <p className="text-white text-sm mb-4">
        These print jobs used filament that couldn't be automatically matched to your inventory.
        Select a color to deduct from stock.
      </p>

      <div className="space-y-3">
        {jobs.map((job: FilamentJob) => (
          <FilamentJobRow
            key={job.id}
            job={job}
            colors={colors}
            selectedColorId={selectedColors[job.id]}
            onColorChange={(colorId) => setSelectedColors((prev) => ({ ...prev, [job.id]: colorId }))}
            onResolve={() => {
              const colorId = selectedColors[job.id];
              if (colorId) resolve({ id: job.id, colorId });
            }}
            onSkip={() => skip(job.id)}
            isResolving={isResolving}
          />
        ))}
      </div>
    </div>
  );
}

function FilamentJobRow({
  job,
  colors,
  selectedColorId,
  onColorChange,
  onResolve,
  onSkip,
  isResolving,
}: {
  job: FilamentJob;
  colors: any[];
  selectedColorId?: number;
  onColorChange: (id: number) => void;
  onResolve: () => void;
  onSkip: () => void;
  isResolving: boolean;
}) {
  const remainDelta = (job.remainStart ?? 0) - (job.remainEnd ?? 0);

  return (
    <div className="rounded p-3 flex flex-col gap-2" style={{ background: '#2d2d2d' }}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* AMS swatch */}
          {job.amsColorHex && (
            <div
              className="w-6 h-6 rounded-full border-2 flex-shrink-0"
              style={{
                background: `#${job.amsColorHex.slice(0, 6)}`,
                borderColor: `#${job.amsColorHex.slice(0, 6)}`,
              }}
            />
          )}
          <div>
            <p className="text-sm font-medium text-white">
              {job.amsColorHex ? `#${job.amsColorHex.slice(0, 6).toUpperCase()}` : 'Unknown color'}{' '}
              <span className="text-white">({job.amsMaterial || 'Unknown material'})</span>
            </p>
            <p className="text-xs text-white">
              {job.printerName} · {job.jobName || 'Unknown job'} · AMS slot {job.amsSlotId}
            </p>
            <p className="text-xs text-white">
              {remainDelta.toFixed(1)}% used · {new Date(job.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            className="input text-sm"
            style={{ width: 200 }}
            value={selectedColorId || ''}
            onChange={(e) => onColorChange(parseInt(e.target.value))}
          >
            <option value="">— Select color —</option>
            {colors
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.manufacturer?.name ? `${c.manufacturer.name} ` : ''}{c.name}
                </option>
              ))}
          </select>
          <button
            className="btn-primary btn-sm"
            onClick={onResolve}
            disabled={!selectedColorId || isResolving}
          >
            Deduct
          </button>
          <button className="btn-secondary btn-sm" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export const PrinterDashboard: React.FC = () => {
  const { liveStatuses, error } = usePrinterDashboard();
  const { printers } = usePrinters();
  const { items: queueItems } = useQueue();

  // Monitor is considered online if we got data back (even an empty array) with no error
  const monitorOnline = !error;

  // Build per-printer display — match by printerId
  const statusById = Object.fromEntries(
    liveStatuses.map((s) => [s.printerId, s]),
  );

  const activePrinters = printers.filter((p) => p.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PageIcon src="/icons/printers.png" alt="Printers" />
          <div>
            <h2 className="text-2xl font-bold text-white">Printer Dashboard</h2>
            <p className="text-white text-sm mt-1">Real-time status for all printers.</p>
          </div>
        </div>
        {error && (
          <span
            className="px-2 py-1 rounded text-xs font-semibold"
            style={{ background: '#b91c1c', color: '#ffffff' }}
          >
            Monitor offline
          </span>
        )}
      </div>

      {/* Filament jobs pending banner */}
      <FilamentJobsPanel />

      {/* Printer columns: printer card + queue card stacked */}
      {activePrinters.length === 0 ? (
        <div className="card text-center py-12 text-white">
          No printers configured. Add printers in Admin → Printers.
        </div>
      ) : (
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {activePrinters.map((printer) => (
            <div key={printer.id} className="flex flex-col gap-4">
              <PrinterCard
                printer={printer}
                status={statusById[printer.id] ?? null}
                monitorOnline={monitorOnline}
              />
              <PrinterQueueCard
                printerName={printer.name}
                items={queueItems.filter((i) => i.printerName === printer.name)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
