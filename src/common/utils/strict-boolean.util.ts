export function preserveRawConsentValue({ obj }: { obj: unknown }): unknown {
  if (typeof obj === 'object' && obj !== null && 'accept_consent' in obj) {
    return (obj as Record<string, unknown>)['accept_consent'];
  }
  return undefined;
}
