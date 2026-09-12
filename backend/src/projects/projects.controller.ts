import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put, Query, ValidationPipe } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { SafeUser } from '../auth/users.repository.js';
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
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Post()
  create(@CurrentUser() user: SafeUser, @Body(createProjectPipe) input: CreateProjectDto): Promise<ProjectResource> {
    return this.projects.create(user, input);
  }

  @Get()
  list(@CurrentUser() user: SafeUser): Promise<{ items: ProjectSummary[] }> {
    return this.projects.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: SafeUser, @Param(projectIdPipe) params: ProjectIdParamsDto): Promise<ProjectResource> {
    return this.projects.get(user, params.id);
  }

  @Put(':id/document')
  saveDocument(@CurrentUser() user: SafeUser, @Param(projectIdPipe) params: ProjectIdParamsDto, @Body(saveDocumentPipe) input: SaveProjectDocumentDto): Promise<ProjectResource> {
    return this.projects.saveDocument(user, params.id, input);
  }

  @Patch(':id')
  updateMetadata(@CurrentUser() user: SafeUser, @Param(projectIdPipe) params: ProjectIdParamsDto, @Body(updateMetadataPipe) input: UpdateProjectMetadataDto): Promise<ProjectResource> {
    return this.projects.updateMetadata(user, params.id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@CurrentUser() user: SafeUser, @Param(projectIdPipe) params: ProjectIdParamsDto, @Query(deleteProjectPipe) query: DeleteProjectQueryDto): Promise<void> {
    await this.projects.delete(user, params.id, query.baseStorageVersion);
  }
}
