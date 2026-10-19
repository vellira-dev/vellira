import { writeFileSync } from 'node:fs';
import path from 'node:path';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// Every frame originates from the already-loaded, actually rendered Storybook
// interaction. Repeat verified state captures for stable social pacing instead
// of recording page creation/navigation and trimming by a guessed timestamp.
export async function capturePhase(page, directory, start, count, posterPath) {
  if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(count) || count < 1) {
    throw new Error('Invalid component demo frame phase.');
  }
  const image = await page.screenshot({ type: 'png', animations: 'disabled' });
  if (!Buffer.isBuffer(image) || !image.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Storybook capture did not return a PNG screenshot.');
  }
  if (posterPath) writeFileSync(posterPath, image);
  for (let i = 0; i < count; i++) {
    writeFileSync(path.join(directory, `frame-${String(start + i).padStart(4, '0')}.png`), image);
  }
  return start + count;
}
