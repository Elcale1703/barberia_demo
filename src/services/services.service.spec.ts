import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ServicesService - Pruebas Unitarias de Caja Blanca', () => {
  let service: ServicesService;
  let prisma: {
    service: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const mockService = {
    id: 1,
    name: 'Corte Degradado',
    description: 'Corte fade con navaja',
    duration: 45,
    price: 30000,
    active: true,
  };

  beforeEach(async () => {
    prisma = {
      service: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('debe lanzar ConflictException si ya existe un servicio con el mismo nombre', async () => {
      prisma.service.findUnique.mockResolvedValue(mockService);

      await expect(
        service.create({
          name: 'Corte Degradado',
          duration: 45,
          price: 30000,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe crear el servicio si el nombre no existe', async () => {
      prisma.service.findUnique.mockResolvedValue(null);
      prisma.service.create.mockResolvedValue(mockService);

      const result = await service.create({
        name: 'Corte Degradado',
        duration: 45,
        price: 30000,
      });

      expect(prisma.service.create).toHaveBeenCalled();
      expect(result).toEqual(mockService);
    });
  });

  describe('findAll()', () => {
    it('debe listar todos los servicios cuando onlyActive es false', async () => {
      prisma.service.findMany.mockResolvedValue([mockService]);

      const result = await service.findAll(false);
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { id: 'asc' },
      });
      expect(result).toEqual([mockService]);
    });

    it('debe filtrar solo activos cuando onlyActive es true', async () => {
      prisma.service.findMany.mockResolvedValue([mockService]);

      const result = await service.findAll(true);
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { id: 'asc' },
      });
      expect(result).toEqual([mockService]);
    });
  });

  describe('findOne()', () => {
    it('debe retornar el servicio si existe', async () => {
      prisma.service.findUnique.mockResolvedValue(mockService);

      const result = await service.findOne(1);
      expect(result).toEqual(mockService);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    it('debe lanzar ConflictException si el nombre actualizado ya existe en otro servicio', async () => {
      prisma.service.findUnique
        .mockResolvedValueOnce(mockService) // findOne
        .mockResolvedValueOnce({ id: 2, name: 'Corte Barba' }); // existing with same name

      await expect(
        service.update(1, { name: 'Corte Barba' }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe actualizar los datos si no hay conflicto', async () => {
      prisma.service.findUnique
        .mockResolvedValueOnce(mockService)
        .mockResolvedValueOnce(null);
      const updated = { ...mockService, price: 35000 };
      prisma.service.update.mockResolvedValue(updated);

      const result = await service.update(1, { price: 35000 });
      expect(result.price).toBe(35000);
    });
  });

  describe('remove()', () => {
    it('debe realizar soft delete (active: false)', async () => {
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.service.update.mockResolvedValue({ ...mockService, active: false });

      const result = await service.remove(1);
      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { active: false },
      });
      expect(result.active).toBe(false);
    });
  });
});
