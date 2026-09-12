import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateBarberDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
