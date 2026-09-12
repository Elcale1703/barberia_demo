import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class AssignServicesDto {
  @IsArray({ message: 'serviceIds debe ser un arreglo de IDs' })
  @ArrayMinSize(1, { message: 'Debe proporcionar al menos un servicio' })
  @IsInt({ each: true, message: 'Cada servicio debe ser un número entero' })
  serviceIds: number[];
}
