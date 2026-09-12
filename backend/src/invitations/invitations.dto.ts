import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  @MaxLength(320)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  email!: string;
}

export class InvitationTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  token!: string;
}

export class InvitationIdParamsDto {
  @IsUUID()
  invitationId!: string;
}

export class ProjectInvitationParamsDto extends InvitationIdParamsDto {
  @IsUUID()
  id!: string;
}
