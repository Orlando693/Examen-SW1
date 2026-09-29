# Project Handoff

## Estado actual

CU-09 Incrementos 1 y 2 COMPLETE 22/22 con OpenSpec activo `cu-09-voice-flutter-generated-app`; pendiente de verify y aceptacion/cierre formal. Flutter fue diferido antes de implementación y no tiene tareas activas.

## Trabajo actual

- `@examen-sw1/local-stt` provee parser RIFF/WAVE chunk-aware, fixture determinista y adaptador Vosk opt-in. ROOT-EQUIVALENT 475/475 PASS; el fix de validator de layout `58858e8` dejo local-stt 19/19, backend voice 3/3 y smoke CLI Vosk real PASS; typecheck/lint/build PASS.
- Gate manual real PASS: microfono, grabacion, Vosk, transcript revisable sin auto-submit, Qwen preview/apply, clase solicitada una vez, persistencia F5 y cancelacion. `POST /assistant/voice/transcriptions` no muta UML ni persistencia.
- La observacion anterior `New Class` para “crea una clase cliente” no se reprodujo y carece de raw Qwen/cause determinista; se documenta como variacion semantica del modelo real, no como fix.
- `AssistantPanel` separa controladores de voz/interpretacion, aborta ambos al desmontar y bloquea preview durante voz activa; sus pruebas focales son 10/10 PASS. `@examen-sw1/local-stt-benchmark` mide `loadLatencyMs` solo con la inicializacion de Vosk antes de leer/transcribir WAV; benchmark 7/7 y local-stt 19/19 PASS. El usuario reviso el Run 3 real externo `benchmark-2026-09-27T15-57-58.122Z.json`: Vosk real, sin proveedor fake, siete casos, hash `02711944638bebebe29e89b73ae75840dc403a9716a81e4f72d7e2840976ed96`, carga pura `1156.822 ms`, WER `0.48`, command success `2/7` y `TRANSCRIPTION_EMPTY` para `failed-transcript`.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); sus fixes exigen upgrades mayores no aprobados.
- Los hashes publicados de upstream para el modelo no estan disponibles y no se inventan. La variacion semantica anterior no tiene causa raiz determinista.
- Archive SHA-256 permanece `null` porque no se invento un hash del ZIP upstream. Los JSON y WAV externos no estan en Git.

## Siguiente accion exacta

Ejecutar `/opsx:verify` para CU-09. Flutter queda como trabajo futuro; no archivar ni hacer push sin aceptacion final.
