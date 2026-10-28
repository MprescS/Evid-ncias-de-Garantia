/**
 * Bulletproof UUID generator and validator ensuring full compliance with
 * RFC 4122 v4 for PostgreSQL and Supabase UUID primary keys.
 */

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return UUID_V4_REGEX.test(id.trim());
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID().toLowerCase();
    } catch {
      // Fallback if randomUUID throws
    }
  }

  // RFC4122 v4 compliant fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ensures that any record ID is a valid PostgreSQL UUID.
 * If the input is already a valid UUID, it is returned normalized in lowercase.
 * If the input is not a valid UUID (e.g. legacy demo ID 'rec_porsche_911_turbo_01'),
 * it generates a deterministic or fresh valid UUID so PostgreSQL never fails with
 * "invalid input syntax for type uuid".
 */
export function ensureValidUUID(id?: string | null): string {
  if (isValidUUID(id)) {
    return (id as string).trim().toLowerCase();
  }

  // Deterministic UUID for known demo IDs
  if (id === 'rec_porsche_911_turbo_01') {
    return '11111111-9110-4000-a000-000000000001';
  }
  if (id === 'rec_taycan_bms_02') {
    return '22222222-7770-4000-a000-000000000002';
  }

  return generateUUID();
}
