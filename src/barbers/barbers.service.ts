import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { AssignServicesDto } from './dto/assign-services.dto';
import { SetSchedulesDto } from './dto/set-schedules.dto';

@Injectable()
export class BarbersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBarberDto) {
    return this.prisma.barber.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        active: dto.active ?? true,
      },
    });
  }

  async findAll(onlyActive = false) {
    return this.prisma.barber.findMany({
      where: onlyActive ? { active: true } : undefined,
      include: {
        services: {
          include: {
            service: true,
          },
        },
        schedules: {
          orderBy: [
            { dayOfWeek: 'asc' },
            { startMinute: 'asc' },
          ],
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const barber = await this.prisma.barber.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        schedules: {
          orderBy: [
            { dayOfWeek: 'asc' },
            { startMinute: 'asc' },
          ],
        },
      },
    });

    if (!barber) {
      throw new NotFoundException(`Barbero con ID ${id} no encontrado`);
    }

    return barber;
  }

  async update(id: number, dto: UpdateBarberDto) {
    await this.findOne(id);
    return this.prisma.barber.update({
      where: { id },
      data: dto,
    });
  }

  async assignServices(barberId: number, dto: AssignServicesDto) {
    await this.findOne(barberId);

    // Verificar que los servicios existan
    const existingServices = await this.prisma.service.findMany({
      where: { id: { in: dto.serviceIds } },
    });

    if (existingServices.length !== dto.serviceIds.length) {
      throw new BadRequestException('Uno o más servicios especificados no existen');
    }

    // Reemplazamos los servicios asignados usando una transacción
    return this.prisma.$transaction(async (tx) => {
      await tx.barberService.deleteMany({
        where: { barberId },
      });

      await tx.barberService.createMany({
        data: dto.serviceIds.map((serviceId) => ({
          barberId,
          serviceId,
        })),
      });

      return tx.barber.findUnique({
        where: { id: barberId },
        include: {
          services: {
            include: {
              service: true,
            },
          },
        },
      });
    });
  }

  async setSchedules(barberId: number, dto: SetSchedulesDto) {
    await this.findOne(barberId);

    // Validar que startMinute < endMinute
    for (const s of dto.schedules) {
      if (s.startMinute >= s.endMinute) {
        throw new BadRequestException(
          `startMinute (${s.startMinute}) debe ser menor que endMinute (${s.endMinute}) para el día ${s.dayOfWeek}`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.barberSchedule.deleteMany({
        where: { barberId },
      });

      await tx.barberSchedule.createMany({
        data: dto.schedules.map((s) => ({
          barberId,
          dayOfWeek: s.dayOfWeek,
          startMinute: s.startMinute,
          endMinute: s.endMinute,
        })),
      });

      return tx.barberSchedule.findMany({
        where: { barberId },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
      });
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.barber.update({
      where: { id },
      data: { active: false },
    });
  }
}
