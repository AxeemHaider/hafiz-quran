// Import this before importing any of the app's TypeScript modules from a Node script (Node >= 22.18
// strips the types itself).
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Lets Node import the app's TypeScript modules as Metro resolves them: `@/` is `src/`, and relative
 * imports inside a .ts module leave out the extension.
 */
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    const base = specifier.startsWith('@/')
      ? join(SRC, specifier.slice(2))
      : specifier.startsWith('.') && context.parentURL?.endsWith('.ts')
        ? fileURLToPath(new URL(specifier, context.parentURL))
        : null;
    const resolved = nextResolve(base && existsSync(`${base}.ts`) ? pathToFileURL(`${base}.ts`).href : specifier, context);
    return resolved.url.endsWith('.ts') ? { ...resolved, format: 'module-typescript' } : resolved;
  },
});
