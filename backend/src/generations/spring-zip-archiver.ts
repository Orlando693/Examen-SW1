import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { ZipFile } from 'yazl';

export interface SpringZipEntry { archivePath: string; content: Uint8Array | string; }
export interface SpringZipArchiver { archive(entries: SpringZipEntry[], destination: string): Promise<void>; }
export const SPRING_ZIP_ARCHIVER = Symbol('SPRING_ZIP_ARCHIVER');

export class YazlSpringZipArchiver implements SpringZipArchiver {
  async archive(entries: SpringZipEntry[], destination: string): Promise<void> {
    const zip = new ZipFile();
    const output = createWriteStream(destination);
    const completed = finished(output);
    zip.outputStream.on('error', (error) => output.destroy(error)).pipe(output);
    for (const entry of entries) zip.addBuffer(Buffer.from(entry.content), entry.archivePath, { mtime: new Date(0), mode: 0o100644 });
    zip.end();
    await completed;
  }
}
