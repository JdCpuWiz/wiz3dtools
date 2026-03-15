import { pool } from '../config/database.js';

export async function writeAuditLog(
  actor: string,
  action: string,
  resource?: string,
  detail?: string,
): Promise<void> {
  try {
    await pool.query(
      'INSERT INTO audit_logs (actor, action, resource, detail) VALUES ($1, $2, $3, $4)',
      [actor, action, resource ?? null, detail ?? null],
    );
  } catch (err) {
    // Audit logging must never crash the main request
    console.error('[AUDIT] Failed to write audit log:', err);
  }
}
