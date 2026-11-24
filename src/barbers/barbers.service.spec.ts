import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BarbersService } from './barbers.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BarbersService - Pruebas Unitarias de Caja Blanca', () => {
  let service: BarbersService;
  let prisma: {
    barber: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    service: {
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const mockBarber = {
    id: 1,
    name: 'Carlos Barbero',
    phone: '3001234567',
    active: true,
    services: [],
    schedules: [],
  };

  beforeEach(async () => {
    prisma = {
      barber: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      service: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BarbersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<BarbersService>(BarbersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('debe crear un nuevo barbero con active por defecto true', async () => {
      prisma.barber.create.mockResolvedValue(mockBarber);

      const result = await service.create({
        name: 'Carlos Barbero',
        phone: '3001234567',
      });

      expect(prisma.barber.create).toHaveBeenCalledWith({
        data: {
          name: 'Carlos Barbero',
          phone: '3001234567',
          active: true,
        },
      });
      expect(result).toEqual(mockBarber);
    });
  });

  describe('findAll()', () => {
    it('debe retornar todos los barberos', async () => {
      prisma.barber.findMany.mockResolvedValue([mockBarber]);

      const result = await service.findAll(false);
      expect(result).toEqual([mockBarber]);
      expect(prisma.barber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('debe filtrar solo activos si onlyActive es true', async () => {
      prisma.barber.findMany.mockResolvedValue([mockBarber]);

      const result = await service.findAll(true);
      expect(result).toEqual([mockBarber]);
      expect(prisma.barber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { active: true } }),
      );
    });
  });

  describe('findOne()', () => {
    it('debe retornar el barbero si existe', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);

      const result = await service.findOne(1);
      expect(result).toEqual(mockBarber);
    });

    it('debe lanzar NotFoundException si el barbero no existe', async () => {
      prisma.barber.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    it('debe actualizar el barbero si existe', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      const updated = { ...mockBarber, name: 'Carlos Gomez' };
      prisma.barber.update.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Carlos Gomez' });
      expect(result.name).toBe('Carlos Gomez');
    });
  });

  describe('assignServices()', () => {
    it('debe lanzar BadRequestException si uno o más servicios no existen', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findMany.mockResolvedValue([{ id: 10 }]); // solo existe 1 de 2

      await expect(
        service.assignServices(1, { serviceIds: [10, 20] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe asignar servicios mediante una transacción si todos existen', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findMany.mockResolvedValue([{ id: 10 }, { id: 20 }]);

      const txMock = {
        barberService: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        barber: {
          findUnique: jest.fn().mockResolvedValue(mockBarber),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(txMock);
      });

      const result = await service.assignServices(1, { serviceIds: [10, 20] });

      expect(txMock.barberService.deleteMany).toHaveBeenCalledWith({
        where: { barberId: 1 },
      });
      expect(txMock.barberService.createMany).toHaveBeenCalledWith({
        data: [
          { barberId: 1, serviceId: 10 },
          { barberId: 1, serviceId: 20 },
        ],
      });
      expect(result).toEqual(mockBarber);
    });
  });

  describe('setSchedules()', () => {
    it('debe lanzar BadRequestException si startMinute >= endMinute', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);

      await expect(
        service.setSchedules(1, {
          schedules: [
            { dayOfWeek: 1, startMinute: 600, endMinute: 500 }, // inválido
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe registrar horarios mediante transacción si los intervalos son válidos', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);

      const txMock = {
        barberSchedule: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
          findMany: jest.fn().mockResolvedValue([
            { id: 1, barberId: 1, dayOfWeek: 1, startMinute: 480, endMinute: 1080 },
          ]),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(txMock);
      });

      const result = await service.setSchedules(1, {
        schedules: [
          { dayOfWeek: 1, startMinute: 480, endMinute: 1080 },
        ],
      });

      expect(txMock.barberSchedule.deleteMany).toHaveBeenCalledWith({
        where: { barberId: 1 },
      });
      expect(txMock.barberSchedule.createMany).toHaveBeenCalledWith({
        data: [
          { barberId: 1, dayOfWeek: 1, startMinute: 480, endMinute: 1080 },
        ],
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('remove()', () => {
    it('debe desactivar el barbero (active: false)', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.barber.update.mockResolvedValue({ ...mockBarber, active: false });

      const result = await service.remove(1);
      expect(prisma.barber.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { active: false },
      });
      expect(result.active).toBe(false);
    });
  });
});
