import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBarberDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del barbero es obligatorio' })
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
