import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ScheduleItemDto {
  @IsInt()
  @Min(0, { message: 'dayOfWeek debe ser entre 0 (Domingo) y 6 (Sábado)' })
  @Max(6, { message: 'dayOfWeek debe ser entre 0 (Domingo) y 6 (Sábado)' })
  dayOfWeek: number;

  @IsInt()
  @Min(0, { message: 'startMinute debe ser >= 0 (00:00)' })
  @Max(1439, { message: 'startMinute debe ser < 1440 (23:59)' })
  startMinute: number;

  @IsInt()
  @Min(1, { message: 'endMinute debe ser >= 1' })
  @Max(1440, { message: 'endMinute debe ser <= 1440' })
  endMinute: number;
}

export class SetSchedulesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un horario' })
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  schedules: ScheduleItemDto[];
}
