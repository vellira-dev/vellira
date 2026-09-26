const OUTPUT_SUMMARY_LIMIT = 4_000;
const OUTPUT_TRUNCATION_MARKER = '\n… output truncated …\n';

export function summarizeValidationOutput(value: string): string {
  const normalized = value.trim();

  if (normalized.length <= OUTPUT_SUMMARY_LIMIT) {
    return normalized;
  }

  const retainedLimit = OUTPUT_SUMMARY_LIMIT - OUTPUT_TRUNCATION_MARKER.length;
  const headLimit = Math.ceil(retainedLimit / 2);
  const tailLimit = retainedLimit - headLimit;

  return [
    normalized.slice(0, headLimit),
    OUTPUT_TRUNCATION_MARKER,
    normalized.slice(-tailLimit),
  ].join('');
}
