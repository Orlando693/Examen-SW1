import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CredentialsDto {
  @IsEmail()
  @MaxLength(320)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
