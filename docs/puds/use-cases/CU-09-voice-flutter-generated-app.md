# CU-09 - Voz y aplicacion movil Flutter generada

## Estado

CU-09 esta activo. Incremento 1 esta COMPLETE con su gate manual 1.12 aceptado. Incremento 2 es el siguiente y el Incremento 3 permanece pendiente; ninguno ha iniciado.

## Politica del modelo STT

- Modelo: `vosk-model-small-es-0.42`.
- Fuente upstream: `https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip`.
- Evidencia de seleccion: la lista oficial de modelos Vosk identifica esta release como modelo espanol ligero, compatible con Vosk API y licenciado Apache-2.0.
- Licencia del modelo: Apache-2.0, segun la misma lista oficial.
- Binding: paquete npm oficial `vosk` `0.3.39`, publicado por Alpha Cephei, Apache-2.0, con `engines.node >=12.x.x`. El runtime objetivo del repositorio es Node 24 LTS sobre Windows x64; la carga nativa se mantiene opt-in y el smoke debe confirmar el binario local antes de declarar compatibilidad operativa.
- Ruta local excluida: `VOSK_MODEL_PATH`, configurada solo en `.env.local` fuera del repositorio. Debe apuntar exactamente al directorio extraido `vosk-model-small-es-0.42`; el validador exige `am/final.mdl`, `conf/model.conf`, `graph/HCLr.fst`, `graph/Gr.fst` y `graph/phones/word_boundary.int`.
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

- ROOT-EQUIVALENT secuencial: 475/475 PASS. Posteriormente se corrigio solo el validador de layout Vosk en commit `58858e8`: `@examen-sw1/local-stt` 19/19 PASS, backend voice 3/3 PASS y smoke CLI real de inicializacion Vosk PASS.
- Root `typecheck`, `lint` y `build`: PASS. Los checks normales no cargan modelo, capturan microfono ni descargan artefactos. No ocurrio `ECONNRESET`.
- Smoke opt-in sin modelo: devuelve de forma segura `MODEL_UNAVAILABLE`; el smoke real confirmado cargo `vosk-model-small-es-0.42` y el recognizer local.

## Pruebas manuales

- Gate 1.12 en navegador real PASS: microfono, Record Voice, Stop Recording, Vosk real, transcript visible y editable, ausencia de auto-submit, envio del texto revisado, generacion Qwen real, preview correcto, ausencia de mutacion antes de Apply, Apply explicito, clase solicitada creada exactamente una vez, persistencia tras F5 y cancelacion.
- Observacion anterior: una ejecucion real de “crea una clase cliente” produjo `New Class`. La investigacion verifico que el transcript llego sin cambios al frontend, backend y `buildAssistantPrompt`, y que adapter, `UmlCommand` y executor preservan `candidate.name`; no existe fallback productivo `New Class`. No se conservo el raw candidate de Qwen, no se establecio causa determinista y no se atribuye a un cambio especifico. Se registra como observacion de variacion semantica del modelo real no reproducida; una reproduccion controlada posterior PASS.

## Limitaciones

- No existe hash publicado verificable para el modelo upstream; los hashes del artefacto local no se inventan ni se registran.
- La variacion semantica observada de modelo real no tuvo causa determinista establecida. La reproduccion posterior correcta no constituye un fix de producto.
