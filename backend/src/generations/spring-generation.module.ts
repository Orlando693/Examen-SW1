import { Module } from '@nestjs/common';
import { tmpdir } from 'node:os';
import { ProjectsModule } from '../projects/projects.module.js';
import { FrontendGenerationController } from './frontend-generation.controller.js';
import { FrontendGenerationService } from './frontend-generation.service.js';
import { SpringGenerationController } from './spring-generation.controller.js';
import { SPRING_GENERATION_TEMP_ROOT, SpringGenerationService } from './spring-generation.service.js';
import { SPRING_ZIP_ARCHIVER, YazlSpringZipArchiver } from './spring-zip-archiver.js';

@Module({
  imports: [ProjectsModule],
  controllers: [SpringGenerationController, FrontendGenerationController],
  providers: [
    SpringGenerationService,
    FrontendGenerationService,
    { provide: SPRING_ZIP_ARCHIVER, useClass: YazlSpringZipArchiver },
    { provide: SPRING_GENERATION_TEMP_ROOT, useValue: tmpdir() },
  ],
})
export class SpringGenerationModule {}
