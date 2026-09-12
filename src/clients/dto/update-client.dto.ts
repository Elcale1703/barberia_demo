import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  @IsOptional()
  email?: string;
}
