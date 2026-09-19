import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService, LOCAL_ASSISTANT_INTERPRETER } from './assistant.service.js';
import { createAssistantInterpreter } from './assistant.provider.js';

@Module({
  imports: [ProjectsModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    { provide: LOCAL_ASSISTANT_INTERPRETER, useFactory: createAssistantInterpreter },
  ],
})
export class AssistantModule {}
