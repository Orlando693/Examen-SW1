import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ValidateIf((_object, value: unknown) => value !== null)
  @IsOptional()
  @IsString()
  description?: string | null;
}

export class SaveDocumentContentDto {
  @IsInt()
  @Min(0)
  revision!: number;

  @IsObject()
  model!: object;

  @IsObject()
  layout!: object;
}

export class SaveProjectDocumentDto {
  @IsInt()
  @Min(0)
  baseStorageVersion!: number;

  @ValidateNested()
  @Type(() => SaveDocumentContentDto)
  document!: SaveDocumentContentDto;
}

export class UpdateProjectMetadataDto {
  @IsInt()
  @Min(0)
  baseStorageVersion!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== null)
  @IsOptional()
  @IsString()
  description?: string | null;
}

export class ProjectIdParamsDto {
  @IsUUID()
  id!: string;
}

export class DeleteProjectQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseStorageVersion!: number;
}
