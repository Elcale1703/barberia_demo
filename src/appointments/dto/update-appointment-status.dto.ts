import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus, {
    message: 'status debe ser PENDING, CONFIRMED, COMPLETED, CANCELLED o NO_SHOW',
  })
  @IsNotEmpty({ message: 'status es obligatorio' })
  status: AppointmentStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
