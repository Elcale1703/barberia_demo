import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class QueryAvailabilityDto {
  @Type(() => Number)
  @IsInt({ message: 'barberId debe ser un número entero' })
  @IsNotEmpty({ message: 'barberId es obligatorio' })
  barberId: number;

  @Type(() => Number)
  @IsInt({ message: 'serviceId debe ser un número entero' })
  @IsNotEmpty({ message: 'serviceId es obligatorio' })
  serviceId: number;

  @IsString()
  @IsNotEmpty({ message: 'date es obligatorio en formato YYYY-MM-DD' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe tener el formato YYYY-MM-DD (ej. 2026-09-15)',
  })
  date: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  stepMinutes?: number; // Intervalo de separación entre slots (por defecto duración del servicio)
}
