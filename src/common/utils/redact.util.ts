const SENSITIVE_KEY_PATTERN = /^(clave|password|password_hash|authorization|device_token)$/i;

export function redactSensitiveFields(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item, seen));
  }

  const record = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(record)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = redactSensitiveFields(entryValue, seen);
    }
  }
  return sanitized;
}
