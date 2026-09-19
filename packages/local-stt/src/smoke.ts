import { VoskSttProvider } from './vosk-provider.js';

const result = await new VoskSttProvider(process.env.VOSK_MODEL_PATH).transcribe({ frames: new Uint8Array() });
console.log(JSON.stringify(result));
process.exitCode = result.status === 'unavailable' ? 2 : 0;
