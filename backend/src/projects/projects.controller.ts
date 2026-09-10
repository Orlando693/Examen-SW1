import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, ValidationPipe } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import type { ProjectResource } from '@examen-sw1/uml-core';
import { CreateProjectDto, DeleteProjectQueryDto, ProjectIdParamsDto, SaveProjectDocumentDto, UpdateProjectMetadataDto } from './projects.dto.js';
import { type ProjectSummary, ProjectsService } from './projects.service.js';

const validationOptions = { transform: true, whitelist: true, forbidNonWhitelisted: true };
const createProjectPipe = new ValidationPipe({ ...validationOptions, expectedType: CreateProjectDto });
const projectIdPipe = new ValidationPipe({ ...validationOptions, expectedType: ProjectIdParamsDto });
const saveDocumentPipe = new ValidationPipe({ ...validationOptions, expectedType: SaveProjectDocumentDto });
const updateMetadataPipe = new ValidationPipe({ ...validationOptions, expectedType: UpdateProjectMetadataDto });
const deleteProjectPipe = new ValidationPipe({ ...validationOptions, expectedType: DeleteProjectQueryDto });

@Controller('projects')
@Public()
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Post()
  create(@Body(createProjectPipe) input: CreateProjectDto): Promise<ProjectResource> {
    return this.projects.create(input);
  }

  @Get()
  list(): Promise<{ items: ProjectSummary[] }> {
    return this.projects.list();
  }

  @Get(':id')
  get(@Param(projectIdPipe) params: ProjectIdParamsDto): Promise<ProjectResource> {
    return this.projects.get(params.id);
  }

  @Put(':id/document')
  saveDocument(@Param(projectIdPipe) params: ProjectIdParamsDto, @Body(saveDocumentPipe) input: SaveProjectDocumentDto): Promise<ProjectResource> {
    return this.projects.saveDocument(params.id, input);
  }

  @Patch(':id')
  updateMetadata(@Param(projectIdPipe) params: ProjectIdParamsDto, @Body(updateMetadataPipe) input: UpdateProjectMetadataDto): Promise<ProjectResource> {
    return this.projects.updateMetadata(params.id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param(projectIdPipe) params: ProjectIdParamsDto, @Query(deleteProjectPipe) query: DeleteProjectQueryDto): Promise<void> {
    await this.projects.delete(params.id, query.baseStorageVersion);
  }
}
