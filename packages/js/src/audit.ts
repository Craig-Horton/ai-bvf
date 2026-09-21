/**
 * Reproducibility: every scoring call carries an audit record naming the
 * engine version, the rules that fired, and the resolved inputs, so a
 * challenged verdict can be reproduced months later without asking any
 * model to remember anything. Deterministic by design: no timestamps.
 */
import type { AuditRecord } from './types.js';

/** Single source of truth for the engine version; bump with package.json. */
export const CORE_VERSION = '0.10.5';

export function buildAudit(rules_fired: string[], inputs_used: Record<string, unknown>): AuditRecord {
  return {
    engine: '@aibvf/core',
    engine_version: CORE_VERSION,
    bvf_version: '1.0',
    rules_fired,
    inputs_used,
    note: 'Deterministic: the same inputs on the same engine version reproduce this result exactly.',
  };
}
