import fs from 'node:fs';
import path from 'node:path';

import prettier from 'prettier';

export type FileWriter = {
  writeIfMissing(filePath: string, content: string): Promise<void>;
  checkFailures: string[];
};

async function formatGeneratedContent(filePath: string, content: string) {
  if (!/\.(?:ts|tsx)$/.test(filePath)) {
    return content;
  }

  const config = await prettier.resolveConfig(filePath);

  return prettier.format(content, {
    ...config,
    filepath: filePath,
  });
}

export function createFileWriter(params: {
  root: string;
  force: boolean;
  check: boolean;
}): FileWriter {
  const { root, force, check } = params;
  const checkFailures: string[] = [];

  return {
    checkFailures,
    async writeIfMissing(filePath, content) {
      const formattedContent = await formatGeneratedContent(filePath, content);
      const exists = fs.existsSync(filePath);

      if (check) {
        const currentContent = exists
          ? fs.readFileSync(filePath, 'utf8')
          : null;

        if (currentContent !== formattedContent) {
          checkFailures.push(path.relative(root, filePath));
        }

        return;
      }

      if (exists && !force) {
        console.log(`⏭ Skipped existing: ${path.relative(root, filePath)}`);
        return;
      }

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, formattedContent);

      console.log(
        `${exists ? '♻️ Updated' : '✅ Created'}: ${path.relative(root, filePath)}`
      );
    },
  };
}
