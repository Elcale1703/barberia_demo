import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ClientsService - Pruebas Unitarias de Caja Blanca', () => {
  let service: ClientsService;
  let prisma: {
    client: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const mockClient = {
    id: 1,
    name: 'Juan Perez',
    phone: '3001112233',
    email: 'juan@test.com',
  };

  beforeEach(async () => {
    prisma = {
      client: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('debe lanzar ConflictException si el teléfono ya está registrado', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);

      await expect(
        service.create({ name: 'Otro', phone: '3001112233' }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe crear un nuevo cliente si el teléfono no existe', async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue(mockClient);

      const result = await service.create({
        name: 'Juan Perez',
        phone: '3001112233',
        email: 'juan@test.com',
      });

      expect(prisma.client.create).toHaveBeenCalledWith({
        data: {
          name: 'Juan Perez',
          phone: '3001112233',
          email: 'juan@test.com',
        },
      });
      expect(result).toEqual(mockClient);
    });
  });

  describe('findOrCreateByPhone()', () => {
    it('debe crear un cliente nuevo si no existe', async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue(mockClient);

      const result = await service.findOrCreateByPhone(
        'Juan Perez',
        '3001112233',
        'juan@test.com',
      );

      expect(prisma.client.create).toHaveBeenCalled();
      expect(result).toEqual(mockClient);
    });

    it('debe actualizar el nombre si el cliente existe pero su nombre difiere', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      const updatedClient = { ...mockClient, name: 'Juan C. Perez' };
      prisma.client.update.mockResolvedValue(updatedClient);

      const result = await service.findOrCreateByPhone(
        'Juan C. Perez',
        '3001112233',
      );

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: mockClient.id },
        data: { name: 'Juan C. Perez' },
      });
      expect(result.name).toBe('Juan C. Perez');
    });

    it('debe retornar el cliente existente sin cambios si el nombre coincide', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);

      const result = await service.findOrCreateByPhone(
        'Juan Perez',
        '3001112233',
      );

      expect(prisma.client.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockClient);
    });
  });

  describe('findAll()', () => {
    it('debe listar los clientes ordenados por fecha descendente', async () => {
      prisma.client.findMany.mockResolvedValue([mockClient]);

      const result = await service.findAll();
      expect(prisma.client.findMany).toHaveBeenCalled();
      expect(result).toEqual([mockClient]);
    });
  });

  describe('findOne()', () => {
    it('debe retornar el cliente si existe', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);

      const result = await service.findOne(1);
      expect(result).toEqual(mockClient);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPhone()', () => {
    it('debe retornar el cliente si existe por teléfono', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);

      const result = await service.findByPhone('3001112233');
      expect(result).toEqual(mockClient);
    });

    it('debe lanzar NotFoundException si no existe por teléfono', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.findByPhone('9999999999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update()', () => {
    it('debe lanzar ConflictException si el teléfono actualizado ya pertenece a otro cliente', async () => {
      prisma.client.findUnique
        .mockResolvedValueOnce(mockClient) // findOne(1)
        .mockResolvedValueOnce({ id: 2, phone: '3009998877' }); // existing with same phone

      await expect(
        service.update(1, { phone: '3009998877' }),
      ).rejects.toThrow(ConflictException);
    });

    it('debe actualizar los datos correctamente si no hay conflicto', async () => {
      prisma.client.findUnique
        .mockResolvedValueOnce(mockClient)
        .mockResolvedValueOnce(null);
      const updated = { ...mockClient, name: 'Juan Modificado' };
      prisma.client.update.mockResolvedValue(updated);

      const result = await service.update(1, { name: 'Juan Modificado' });
      expect(result.name).toBe('Juan Modificado');
    });
  });

  describe('remove()', () => {
    it('debe eliminar el cliente si existe', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.client.delete.mockResolvedValue(mockClient);

      const result = await service.remove(1);
      expect(prisma.client.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockClient);
    });
  });
});
