# Project Handoff

## Estado actual

CU-09 Incremento 1 tareas 1.1-1.11 COMPLETE con OpenSpec activo `cu-09-voice-flutter-generated-app`. Incrementos 2 y 3 no iniciados; 1.12 manual sigue pendiente.

## Trabajo actual

- Nuevo paquete `@examen-sw1/local-stt`: contrato final cerrado, parser RIFF/WAVE chunk-aware, fixture determinista y adaptador Vosk opt-in. Backend 179/179 y frontend 184/184 PASS; root typecheck/lint/build PASS.
- Backend JWT `POST /assistant/voice/transcriptions`, sin mutacion UML/persistencia ni conversion de audio; panel existente permite grabar, revisar/editar y solo despues enviar texto al flujo CU-08.
- Modelo fijado como `vosk-model-small-es-0.42`; upstream no publica hashes verificables del ZIP/directorio, por lo que se documentan como no disponibles y no se inventan.

## Limitaciones vigentes

- `npm audit --omit=dev` reporta 5 vulnerabilidades transitivas (2 moderadas y 3 altas); sus fixes exigen upgrades mayores no aprobados.
- El smoke real Vosk requiere modelo local externo, hashes provistos por quien lo provisiona y runtime nativo compatible; no se ha ejecutado.

## Siguiente accion exacta

Ejecutar gate manual 1.12 en navegador real. No iniciar Incrementos 2/3, no archivar ni hacer push.
