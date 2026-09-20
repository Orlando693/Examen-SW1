# Project Handoff

## Estado actual

CU-09 Incremento 1 COMPLETE 12/12 con OpenSpec activo `cu-09-voice-flutter-generated-app`. Incremento 2 es NEXT e Incremento 3 PENDING; ambos no iniciados.

## Trabajo actual

- `@examen-sw1/local-stt` provee parser RIFF/WAVE chunk-aware, fixture determinista y adaptador Vosk opt-in. ROOT-EQUIVALENT 475/475 PASS; el fix de validator de layout `58858e8` dejo local-stt 19/19, backend voice 3/3 y smoke CLI Vosk real PASS; typecheck/lint/build PASS.
- Gate manual real PASS: microfono, grabacion, Vosk, transcript revisable sin auto-submit, Qwen preview/apply, clase solicitada una vez, persistencia F5 y cancelacion. `POST /assistant/voice/transcriptions` no muta UML ni persistencia.
- La observacion anterior `New Class` para “crea una clase cliente” no se reprodujo y carece de raw Qwen/cause determinista; se documenta como variacion semantica del modelo real, no como fix.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); sus fixes exigen upgrades mayores no aprobados.
- Los hashes publicados de upstream para el modelo no estan disponibles y no se inventan. La variacion semantica anterior no tiene causa raiz determinista.

## Siguiente accion exacta

Esperar instruccion explicita para Incremento 2. No iniciar Flutter, no archivar ni hacer push.
