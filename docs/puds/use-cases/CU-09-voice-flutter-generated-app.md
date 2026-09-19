# CU-09 - Voz y aplicacion movil Flutter generada

## Estado

CU-09 esta activo. Incremento 1 implementa la transcripcion local revisable; su gate manual 1.12 sigue pendiente. Incrementos 2 y 3 no han iniciado.

## Politica del modelo STT

- Modelo: `vosk-model-small-es-0.42`.
- Fuente upstream: `https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip`.
- Evidencia de seleccion: la lista oficial de modelos Vosk identifica esta release como modelo espanol ligero, compatible con Vosk API y licenciado Apache-2.0.
- Licencia del modelo: Apache-2.0, segun la misma lista oficial.
- Binding: paquete npm oficial `vosk` `0.3.39`, publicado por Alpha Cephei, Apache-2.0, con `engines.node >=12.x.x`. El runtime objetivo del repositorio es Node 24 LTS sobre Windows x64; la carga nativa se mantiene opt-in y el smoke debe confirmar el binario local antes de declarar compatibilidad operativa.
- Ruta local excluida: `VOSK_MODEL_PATH`, configurada solo en `.env.local` fuera del repositorio. Debe apuntar exactamente al directorio extraido `vosk-model-small-es-0.42` con `am/final.mdl`, `conf/model.conf` y `graph/phones.txt`.
- SHA-256 del archive: no publicado por el upstream en su pagina ni en sidecar `.sha256`/`.sha256sum`; no se inventa ni se registra un valor.
- SHA-256 del directorio extraido: no verificable sin disponer del artefacto local; no se inventa ni se registra un valor.
- Provision local obligatoria: antes de ejecutar el smoke, la persona que provee el artefacto debe calcular ambos SHA-256 y compararlos contra su fuente de provision. No descargar, instalar, empaquetar ni commitear modelos es parte de esta politica.

## Implementacion del Incremento 1

- `@examen-sw1/local-stt` define diagnosticos cerrados, resultado final acotado, parser RIFF/WAVE chunk-aware y proveedores determinista/Vosk.
- El parser acepta solo PCM format 1 mono PCM16LE a 16 kHz, valida padding, tamanos RIFF/chunk, PCM maximo de 1,920,000 bytes, duracion maxima de 60 segundos y transporte de 2,097,152 bytes sin asumir un header de 44 bytes.
- `POST /assistant/voice/transcriptions` requiere JWT Bearer y `audio/wav`, valida antes de STT y entrega solo texto final o diagnostico. No importa `assistant-core`, `uml-core`, preview, Command Bus ni persistencia.
- El navegador captura explicitamente con `getUserMedia` y `AudioWorklet`, downmix, remuestreo lineal 16 kHz y WAV PCM16LE. No usa MediaRecorder, WebM/Opus ni FFmpeg. El transcript final queda editable y requiere pulsar el flujo existente `Generate preview`.
- La cancelacion libera tracks/grafo, aborta upload y no publica transcript ni ejecuta interpretacion.

## Pruebas

- `@examen-sw1/local-stt`: 9/9 PASS, incluyendo los ocho escenarios WAV y provider determinista sin modelo, microfono o dispositivo.
- Backend: 179/179 PASS; frontend: 184/184 PASS.
- Root `typecheck`, `lint` y `build`: PASS. El intento literal de `npm run test` excedio el limite externo despues de una falla de timeout frontend que se corrigio; los workspaces modificados se ejecutaron despues de forma aislada y PASS. No ocurrio `ECONNRESET`.
- `openspec validate cu-09-voice-flutter-generated-app --strict`, main specs strict y `git diff --check`: PASS.
- Smoke opt-in sin modelo: devuelve de forma segura `MODEL_UNAVAILABLE`; no cargo modelo ni uso inferencia remota.

## Pruebas manuales

- No ejecutadas. La tarea 1.12 permanece sin marcar y es el gate requerido antes de avanzar el incremento.

## Limitaciones

- No existe hash publicado verificable para el modelo upstream; el smoke real y su evidencia quedan opt-in hasta que se provea un artefacto local con hashes verificables.
- El gate manual de navegador 1.12 no se ha ejecutado y no se declara aceptacion manual.
