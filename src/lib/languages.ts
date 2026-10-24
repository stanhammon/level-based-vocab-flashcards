/**
 * Per-language settings the CSV can't express (SPEC §3.2). The key is the
 * language name from the CSV's first header, lower-cased (`spanish word` →
 * `spanish`). A language missing here still works, with text-to-speech off.
 */
export const LANGUAGE_CONFIG: Record<string, { code: string; tts: string[] }> = {
  spanish: { code: 'es', tts: ['es-MX', 'es-US', 'es'] },
  german: { code: 'de', tts: ['de-DE', 'de'] },
}
