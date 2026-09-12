import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceDto) {
    const existing = await this.prisma.service.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Ya existe un servicio con el nombre "${dto.name}"`);
    }

    return this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description,
        duration: dto.duration,
        price: dto.price,
        active: dto.active ?? true,
      },
    });
  }

  async findAll(onlyActive = false) {
    return this.prisma.service.findMany({
      where: onlyActive ? { active: true } : undefined,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        barbers: {
          include: {
            barber: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException(`Servicio con ID ${id} no encontrado`);
    }

    return service;
  }

  async update(id: number, dto: UpdateServiceDto) {
    await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.service.findUnique({
        where: { name: dto.name },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Ya existe otro servicio con el nombre "${dto.name}"`);
      }
    }

    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    // Soft delete para preservar el histórico de citas
    return this.prisma.service.update({
      where: { id },
      data: { active: false },
    });
  }
}
