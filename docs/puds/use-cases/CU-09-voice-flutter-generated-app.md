# CU-09 - Voz y benchmark STT reproducible

## Estado

CU-09 esta COMPLETADO, VERIFIED, aceptado formalmente y archivado como `openspec/changes/archive/2026-09-30-cu-09-voice-flutter-generated-app`. Los Incrementos 1 y 2 completaron 22/22 tareas OpenSpec. Flutter fue alcance original, pero se difirio antes de implementacion como trabajo futuro y no es criterio de aceptacion de esta entrega.

## Politica del modelo STT

- Modelo: `vosk-model-small-es-0.42`.
- Fuente upstream: `https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip`.
- Evidencia de seleccion: la lista oficial de modelos Vosk identifica esta release como modelo espanol ligero, compatible con Vosk API y licenciado Apache-2.0.
- Licencia del modelo: Apache-2.0, segun la misma lista oficial.
- Binding: paquete npm oficial `vosk` `0.3.39`, publicado por Alpha Cephei, Apache-2.0, con `engines.node >=12.x.x`. El runtime objetivo del repositorio es Node 24 LTS sobre Windows x64; la carga nativa se mantiene opt-in y el smoke debe confirmar el binario local antes de declarar compatibilidad operativa.
- Ruta local excluida: `VOSK_MODEL_PATH`, configurada solo en `.env.local` fuera del repositorio. Debe apuntar exactamente al directorio extraido `vosk-model-small-es-0.42`; el validador exige `am/final.mdl`, `conf/model.conf`, `graph/HCLr.fst`, `graph/Gr.fst` y `graph/phones/word_boundary.int`.
- SHA-256 del archive: no publicado por el upstream en su pagina ni en sidecar `.sha256`/`.sha256sum`; no se inventa ni se registra un valor.
- SHA-256 del directorio extraido: `02711944638bebebe29e89b73ae75840dc403a9716a81e4f72d7e2840976ed96`, medido localmente con el helper determinista que ordena rutas relativas normalizadas y hash de bytes; el archive permanece `null` porque no se dispone de un hash verificable del ZIP upstream.
- Provision local obligatoria: el directorio extraido se valida antes del benchmark. No descargar, instalar, empaquetar ni commitear modelos es parte de esta politica.

## Implementacion del Incremento 1

- `@examen-sw1/local-stt` define diagnosticos cerrados, resultado final acotado, parser RIFF/WAVE chunk-aware y proveedores determinista/Vosk.
- El parser acepta solo PCM format 1 mono PCM16LE a 16 kHz, valida padding, tamanos RIFF/chunk, PCM maximo de 1,920,000 bytes, duracion maxima de 60 segundos y transporte de 2,097,152 bytes sin asumir un header de 44 bytes.
- `POST /assistant/voice/transcriptions` requiere JWT Bearer y `audio/wav`, valida antes de STT y entrega solo texto final o diagnostico. No importa `assistant-core`, `uml-core`, preview, Command Bus ni persistencia.
- El navegador captura explicitamente con `getUserMedia` y `AudioWorklet`, downmix, remuestreo lineal 16 kHz y WAV PCM16LE. No usa MediaRecorder, WebM/Opus ni FFmpeg. El transcript final queda editable y requiere pulsar el flujo existente `Generate preview`.
- La cancelacion libera tracks/grafo, aborta solo el upload de voz y no publica transcript ni ejecuta interpretacion. La interpretacion y la transcripcion mantienen controladores separados, descartan resultados tardios y se abortan al desmontar el panel; no se puede iniciar preview mientras la voz esta activa.

## Pruebas

- ROOT-EQUIVALENT secuencial: 475/475 PASS. Posteriormente se corrigio solo el validador de layout Vosk en commit `58858e8`: `@examen-sw1/local-stt` 19/19 PASS, backend voice 3/3 PASS y smoke CLI real de inicializacion Vosk PASS.
- Root `typecheck`, `lint` y `build`: PASS. Los checks normales no cargan modelo, capturan microfono ni descargan artefactos. No ocurrio `ECONNRESET`.
- Smoke opt-in sin modelo: devuelve de forma segura `MODEL_UNAVAILABLE`; el smoke real confirmado cargo `vosk-model-small-es-0.42` y el recognizer local.

## Pruebas manuales

- Gate 1.12 en navegador real PASS: microfono, Record Voice, Stop Recording, Vosk real, transcript visible y editable, ausencia de auto-submit, envio del texto revisado, generacion Qwen real, preview correcto, ausencia de mutacion antes de Apply, Apply explicito, clase solicitada creada exactamente una vez, persistencia tras F5 y cancelacion.
- Observacion anterior: una ejecucion real de “crea una clase cliente” produjo `New Class`. La investigacion verifico que el transcript llego sin cambios al frontend, backend y `buildAssistantPrompt`, y que adapter, `UmlCommand` y executor preservan `candidate.name`; no existe fallback productivo `New Class`. No se conservo el raw candidate de Qwen, no se establecio causa determinista y no se atribuye a un cambio especifico. Se registra como observacion de variacion semantica del modelo real no reproducida; una reproduccion controlada posterior PASS.

## Incremento 2 - Preparacion automatizada

- `@examen-sw1/local-stt-benchmark` contiene solo un manifest sintetico versionado. Cada descriptor tiene ID estable, categoria, clasificacion `manual-external`, transcript de referencia, expectativa de preview, y referencia de audio externo por ruta relativa, tamanio y SHA-256; no contiene audio, modelos ni resultados crudos.
- La normalizacion WER convierte casing espanol a minusculas, recorta/colapsa espacios y elimina puntuacion, preservando acentos, digitos e identificadores UML como `_`. Conserva evidencia por caso sin normalizar y contabiliza sustituciones, inserciones, eliminaciones y denominador de referencias.
- El calculo de command success exige que el transcript reconocido, tras la normalizacion declarada, coincida con el transcript esperado y despues evalua exclusivamente el candidato esperado determinista con `createPreview()` de CU-08. No carga Qwen, no aplica previews y verifica que el contexto UML no cambia.
- El runner opt-in `npm run benchmark --workspace @examen-sw1/local-stt-benchmark` exige `VOSK_MODEL_PATH` y `STT_BENCHMARK_AUDIO_ROOT`. Verifica modelo, referencias externas, SHA-256, longitud y WAV antes de Vosk; falla cerrado en prerrequisitos, audio ausente/invalido, checksum, ID duplicado, resultado de transcripcion o resume incompatible. Sus JSON acotados se escriben fuera del arbol fuente, con `--case` y `--resume`; `loadLatencyMs` mide solo `VoskSttProvider.initialize()` antes de leer o transcribir un WAV, mientras cada caso conserva su latencia total/de transcripcion. Tambien registran CPU/RAM antes/despues y VRAM `null`/`notApplicable`.
- La proyeccion durable sanitizada no contiene rutas locales, transcripciones ni audio. Las observaciones manuales son `null`, no medidas. Los hashes upstream no publicados siguen en `null`, no inventados.
- Checks automatizados de la correccion: `AssistantPanel` 10/10 PASS, `@examen-sw1/local-stt` 19/19 PASS y `@examen-sw1/local-stt-benchmark` 7/7 PASS. La prueba de runner demuestra que medir carga no invoca transcripcion. No se cargo Vosk, no se requirio modelo/corpus, no se capturo microfono y no se ejecuto el benchmark real durante esos checks.
- Evidencia real historica (2026-09-27), Run 1: preflight verifico las siete grabaciones externas PCM WAV, sus longitudes y SHA-256, el directorio Vosk y su hash; el runner uso `VoskSttProvider`, sin proveedor determinista ni Qwen. Artefacto externo retenido fuera de Git: `benchmark-2026-09-27T05-01-25.049Z.json`. Dataset `stt-spanish-case-v1-2026-09-20`, Node `v24.19.0`, Windows x64, Intel Core i5-5300U (4 CPUs logicos); WER agregado `12/25 = 0.48`, command success `2/7 = 0.2857142857142857`, latencia total `13241.270100000003 ms`, promedio `1891.6100142857147 ms`, RSS `109584384 -> 154902528`, heap `6579112 -> 5547768`, VRAM `null/notApplicable`. `failed-transcript` produjo el diagnostico real `TRANSCRIPTION_EMPTY` y WER `1`; no hubo `TRANSCRIPTION_FAILED`. Su valor historico `load = 4392.1429 ms` incluyo la primera transcripcion y no es una medicion pura de carga.
- Evidencia real historica, Run 2: mismo modelo, hash de directorio, dataset, siete identidades WAV y Vosk real; artefacto externo `benchmark-2026-09-27T05-06-40.852Z.json`. Reprodujo WER `12/25 = 0.48`, command success `2/7 = 0.2857142857142857` y `failed-transcript -> TRANSCRIPTION_EMPTY`; latencia total `7389.5104 ms`, promedio `1055.6443428571429 ms`, RSS `49373184 -> 154574848`, heap `5989904 -> 5550584`. Su valor historico `load = 2555.7520999999997 ms` tambien incluyo la primera transcripcion y no es una medicion pura de carga.
- Evidencia real corregida, Run 3: el usuario reviso personalmente el artefacto externo `benchmark-2026-09-27T15-57-58.122Z.json`. El runner uso Vosk real, sin proveedor fake, proceso los siete casos y verifico el hash de directorio `02711944638bebebe29e89b73ae75840dc403a9716a81e4f72d7e2840976ed96`. `loadLatencyMs = 1156.822` mide solo inicializacion; WER agregado `12/25 = 0.48`, command success `2/7`, y `failed-transcript -> TRANSCRIPTION_EMPTY`. No se inventan latencias o recursos adicionales no confirmados.
- Gate manual 2.10 COMPLETE: el usuario reviso el benchmark real corregido, su carga pura, modelo/hash, Vosk real sin proveedor fake, siete casos procesados, WER, command success y diagnostico visible. Los JSON completos y WAV permanecen fuera del repositorio; observaciones manuales estructuradas permanecen `null` porque no se inventaron.

## Limitaciones

- No existe hash publicado verificable para el modelo upstream; los hashes del artefacto local no se inventan ni se registran.
- La variacion semantica observada de modelo real no tuvo causa determinista establecida. La reproduccion posterior correcta no constituye un fix de producto.

## Resultado final

- Verify CU-09: PASS. Las pruebas seriales focales verificaron `@examen-sw1/local-stt` 19/19, `@examen-sw1/local-stt-benchmark` 7/7, backend voice 5/5 y frontend voice/AssistantPanel 11/11; typecheck, lint y build de los paquetes STT, backend y frontend pasaron.
- Los gates manuales de los Incrementos 1 y 2 permanecen documentados como PASS.
- El usuario acepto formalmente CU-09 antes del archive. Los delta specs se conservaron dentro del archive y no se sincronizaron a `openspec/specs/` durante este cierre.
