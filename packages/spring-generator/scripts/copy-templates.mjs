import { cp, mkdir } from 'node:fs/promises';

await mkdir('dist/templates', { recursive: true });
await cp('templates', 'dist/templates', { recursive: true });
