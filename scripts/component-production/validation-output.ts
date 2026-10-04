import { stripVTControlCharacters } from 'node:util';

const OUTPUT_SUMMARY_LIMIT = 4_000;
const OUTPUT_TRUNCATION_MARKER = '\n… output truncated …\n';

export function summarizeValidationOutput(
  value: string,
  limit = OUTPUT_SUMMARY_LIMIT
): string {
  const normalized = value.trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  const retainedLimit = limit - OUTPUT_TRUNCATION_MARKER.length;
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
    stripVTControlCharacters(
      [execution.stdout, execution.stderr]
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .join('\n')
      // Colour sequences are presentation, not evidence. Retain the complete
      // bounded transcript, not just its first/last progress messages. A
      // truncated transcript is explicitly incomplete and cannot authorize repair.
    ),
    64_000
  );
}
