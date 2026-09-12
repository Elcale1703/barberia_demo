import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto) {
    const existing = await this.prisma.client.findUnique({
      where: { phone: dto.phone },
    });

    if (existing) {
      throw new ConflictException(`Ya existe un cliente con el teléfono ${dto.phone}`);
    }

    return this.prisma.client.create({
      data: dto,
    });
  }

  async findOrCreateByPhone(name: string, phone: string, email?: string) {
    let client = await this.prisma.client.findUnique({
      where: { phone },
    });

    if (!client) {
      client = await this.prisma.client.create({
        data: {
          name,
          phone,
          email,
        },
      });
    } else if (name && client.name !== name) {
      client = await this.prisma.client.update({
        where: { id: client.id },
        data: { name },
      });
    }

    return client;
  }

  async findAll() {
    return this.prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { appointments: true },
        },
      },
    });
  }

  async findOne(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { startTime: 'desc' },
          include: {
            barber: true,
            service: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado`);
    }

    return client;
  }

  async findByPhone(phone: string) {
    const client = await this.prisma.client.findUnique({
      where: { phone },
      include: {
        appointments: {
          orderBy: { startTime: 'desc' },
          include: {
            barber: true,
            service: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Cliente con teléfono ${phone} no encontrado`);
    }

    return client;
  }

  async update(id: number, dto: UpdateClientDto) {
    await this.findOne(id);

    if (dto.phone) {
      const existing = await this.prisma.client.findUnique({
        where: { phone: dto.phone },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`El teléfono ${dto.phone} ya está en uso por otro cliente`);
      }
    }

    return this.prisma.client.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.client.delete({
      where: { id },
    });
  }
}
