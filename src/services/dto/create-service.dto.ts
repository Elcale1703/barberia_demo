import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del servicio es obligatorio' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsPositive({ message: 'La duración debe ser un número entero positivo de minutos' })
  duration: number;

  @IsInt()
  @Min(0, { message: 'El precio debe ser mayor o igual a 0' })
  price: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
