export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Strips MongoDB operator keys (e.g. "$ne", "$where") from a query object so
// raw req.query values can't be used to inject query operators.
export function sanitizeQueryObject(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;

    if (Array.isArray(value)) {
      sanitized[key] = value;
    } else if (value && typeof value === 'object') {
      const nested = sanitizeQueryObject(value as Record<string, unknown>);
      if (Object.keys(nested).length) {
        sanitized[key] = nested;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
