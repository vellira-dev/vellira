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

export function summarizeValidationCommandOutput(execution: {
  stdout: string;
  stderr: string;
}): string {
  return summarizeValidationOutput(
    [execution.stdout, execution.stderr]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join('\n')
  );
}
