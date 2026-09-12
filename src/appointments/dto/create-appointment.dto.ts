import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class CreateAppointmentDto {
  @IsInt({ message: 'barberId debe ser un número entero' })
  @IsNotEmpty({ message: 'barberId es obligatorio' })
  barberId: number;

  @IsInt({ message: 'serviceId debe ser un número entero' })
  @IsNotEmpty({ message: 'serviceId es obligatorio' })
  serviceId: number;

  @IsDateString({}, { message: 'startTime debe ser una fecha/hora válida en formato ISO (ej. 2026-09-12T14:00:00Z)' })
  @IsNotEmpty({ message: 'startTime es obligatorio' })
  startTime: string;

  // Si se pasa clientId existente
  @IsInt()
  @IsOptional()
  clientId?: number;

  // O si se crea/asocia cliente al vuelo con nombre y teléfono
  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  clientPhone?: string;

  @IsEmail()
  @IsOptional()
  clientEmail?: string;

  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  source?: string;
}
