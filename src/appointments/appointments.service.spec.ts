import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { AppointmentStatus } from '@prisma/client';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

describe('AppointmentsService - Pruebas de Caja Blanca', () => {
  let service: AppointmentsService;
  let prisma: {
    barber: { findUnique: jest.Mock };
    service: { findUnique: jest.Mock };
    barberService: { findUnique: jest.Mock };
    client: { findUnique: jest.Mock };
    barberSchedule: { findMany: jest.Mock };
    appointment: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let clientsService: {
    findOrCreateByPhone: jest.Mock;
  };

  const mockBarber = {
    id: 1,
    name: 'Carlos Barbero',
    phone: '3001234567',
    active: true,
  };

  const mockService = {
    id: 10,
    name: 'Corte Clásico',
    duration: 30, // 30 minutos
    price: 25000,
    active: true,
  };

  const mockBarberService = {
    id: 100,
    barberId: 1,
    serviceId: 10,
  };

  const mockClient = {
    id: 50,
    name: 'Juan Perez',
    phone: '3109876543',
    email: 'juan@test.com',
  };

  beforeEach(async () => {
    prisma = {
      barber: { findUnique: jest.fn() },
      service: { findUnique: jest.fn() },
      barberService: { findUnique: jest.fn() },
      client: { findUnique: jest.fn() },
      barberSchedule: { findMany: jest.fn() },
      appointment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    clientsService = {
      findOrCreateByPhone: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClientsService, useValue: clientsService },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. FUNCIÓN: create()
  // =========================================================================
  describe('1. create() - Validación de barbero, servicio, cliente, horarios y conflictos', () => {
    const validDto: CreateAppointmentDto = {
      barberId: 1,
      serviceId: 10,
      clientId: 50,
      startTime: '2026-09-14T09:00:00-05:00', // Lunes 9:00 AM (minuto 540)
    };

    const validSchedule = [
      {
        id: 1,
        barberId: 1,
        dayOfWeek: 1, // Lunes
        startMinute: 480, // 8:00 AM
        endMinute: 1080, // 6:00 PM
      },
    ];

    it('1.1 Debe lanzar NotFoundException si el barbero no existe', async () => {
      prisma.barber.findUnique.mockResolvedValue(null);

      await expect(service.create(validDto)).rejects.toThrow(
        new NotFoundException(`Barbero con ID ${validDto.barberId} no encontrado o inactivo`),
      );
      expect(prisma.barber.findUnique).toHaveBeenCalledWith({ where: { id: validDto.barberId } });
    });

    it('1.2 Debe lanzar NotFoundException si el barbero está inactivo', async () => {
      prisma.barber.findUnique.mockResolvedValue({ ...mockBarber, active: false });

      await expect(service.create(validDto)).rejects.toThrow(
        new NotFoundException(`Barbero con ID ${validDto.barberId} no encontrado o inactivo`),
      );
    });

    it('1.3 Debe lanzar NotFoundException si el servicio no existe', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(service.create(validDto)).rejects.toThrow(
        new NotFoundException(`Servicio con ID ${validDto.serviceId} no encontrado o inactivo`),
      );
    });

    it('1.4 Debe lanzar NotFoundException si el servicio está inactivo', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue({ ...mockService, active: false });

      await expect(service.create(validDto)).rejects.toThrow(
        new NotFoundException(`Servicio con ID ${validDto.serviceId} no encontrado o inactivo`),
      );
    });

    it('1.5 Debe lanzar BadRequestException si el barbero no ofrece el servicio especificado', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.barberService.findUnique.mockResolvedValue(null);

      await expect(service.create(validDto)).rejects.toThrow(
        new BadRequestException(
          `El barbero ${mockBarber.name} no tiene asignado el servicio "${mockService.name}"`,
        ),
      );
    });

    it('1.6 Debe lanzar BadRequestException si no se provee clientId ni (clientName + clientPhone)', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.barberService.findUnique.mockResolvedValue(mockBarberService);

      const dtoWithoutClient: CreateAppointmentDto = {
        barberId: 1,
        serviceId: 10,
        startTime: '2026-09-14T09:00:00-05:00',
      };

      await expect(service.create(dtoWithoutClient)).rejects.toThrow(
        new BadRequestException(
          'Debe proveer un clientId existente o el nombre y teléfono del cliente (clientName y clientPhone)',
        ),
      );
    });

    it('1.7 Debe lanzar NotFoundException si se provee clientId pero no existe en BD', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.barberService.findUnique.mockResolvedValue(mockBarberService);
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.create(validDto)).rejects.toThrow(
        new NotFoundException(`Cliente con ID ${validDto.clientId} no encontrado`),
      );
    });

    it('1.8 Debe llamar a clientsService.findOrCreateByPhone si no se envía clientId pero sí datos del cliente', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.barberService.findUnique.mockResolvedValue(mockBarberService);
      clientsService.findOrCreateByPhone.mockResolvedValue(mockClient);
      prisma.barberSchedule.findMany.mockResolvedValue(validSchedule);
      prisma.appointment.findFirst.mockResolvedValue(null);
      prisma.appointment.create.mockImplementation(({ data }) => Promise.resolve({ id: 99, ...data }));

      const dtoWithNewClient: CreateAppointmentDto = {
        barberId: 1,
        serviceId: 10,
        clientName: 'Pedro Gomez',
        clientPhone: '3201112233',
        clientEmail: 'pedro@test.com',
        startTime: '2026-09-14T09:00:00-05:00',
      };

      const result = await service.create(dtoWithNewClient);

      expect(clientsService.findOrCreateByPhone).toHaveBeenCalledWith(
        'Pedro Gomez',
        '3201112233',
        'pedro@test.com',
      );
      expect(result.clientId).toBe(mockClient.id);
    });

    it('1.9 Debe lanzar BadRequestException si el formato de startTime es inválido', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.barberService.findUnique.mockResolvedValue(mockBarberService);
      prisma.client.findUnique.mockResolvedValue(mockClient);

      const invalidDateDto = { ...validDto, startTime: 'fecha-invalida' };

      await expect(service.create(invalidDateDto)).rejects.toThrow(
        new BadRequestException('Formato de fecha inválido para startTime'),
      );
    });

    it('1.10 Debe lanzar BadRequestException si el barbero no labora el día solicitado', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.barberService.findUnique.mockResolvedValue(mockBarberService);
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.barberSchedule.findMany.mockResolvedValue([]); // No horarios

      await expect(service.create(validDto)).rejects.toThrow(
        new BadRequestException(`El barbero ${mockBarber.name} no labora en este día de la semana`),
      );
    });

    it('1.11 Debe lanzar BadRequestException si la cita se solicita fuera del horario laboral', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.barberService.findUnique.mockResolvedValue(mockBarberService);
      prisma.client.findUnique.mockResolvedValue(mockClient);
      // Barbero trabaja de 10:00 AM (600m) a 12:00 PM (720m)
      prisma.barberSchedule.findMany.mockResolvedValue([
        { id: 1, barberId: 1, dayOfWeek: 1, startMinute: 600, endMinute: 720 },
      ]);

      // validDto es a las 9:00 AM (540m a 570m), por ende fuera de horario
      await expect(service.create(validDto)).rejects.toThrow(BadRequestException);
    });

    it('1.12 Debe lanzar ConflictException si ya existe una cita solapada en ese horario', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.barberService.findUnique.mockResolvedValue(mockBarberService);
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.barberSchedule.findMany.mockResolvedValue(validSchedule);

      const overlappingApp = {
        id: 77,
        startTime: new Date('2026-09-14T09:15:00-05:00'),
        endTime: new Date('2026-09-14T09:45:00-05:00'),
      };
      prisma.appointment.findFirst.mockResolvedValue(overlappingApp);

      await expect(service.create(validDto)).rejects.toThrow(ConflictException);
    });

    it('1.13 Debe crear la cita con valores por defecto (status: CONFIRMED, source: VAPI) cuando no se proveen', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.barberService.findUnique.mockResolvedValue(mockBarberService);
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.barberSchedule.findMany.mockResolvedValue(validSchedule);
      prisma.appointment.findFirst.mockResolvedValue(null);

      const createdAppointment = {
        id: 1,
        barberId: 1,
        serviceId: 10,
        clientId: 50,
        startTime: new Date('2026-09-14T09:00:00-05:00'),
        endTime: new Date('2026-09-14T09:30:00-05:00'),
        status: AppointmentStatus.CONFIRMED,
        notes: undefined,
        source: 'VAPI',
      };
      prisma.appointment.create.mockResolvedValue(createdAppointment);

      const result = await service.create(validDto);

      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AppointmentStatus.CONFIRMED,
            source: 'VAPI',
          }),
        }),
      );
      expect(result).toEqual(createdAppointment);
    });

    it('1.14 Debe crear la cita con status, notes y source personalizados si vienen en el DTO', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.barberService.findUnique.mockResolvedValue(mockBarberService);
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.barberSchedule.findMany.mockResolvedValue(validSchedule);
      prisma.appointment.findFirst.mockResolvedValue(null);

      const customDto: CreateAppointmentDto = {
        ...validDto,
        status: AppointmentStatus.PENDING,
        notes: 'Corte degradado bajo con navaja',
        source: 'WEB_APP',
      };

      prisma.appointment.create.mockImplementation(({ data }) => Promise.resolve({ id: 2, ...data }));

      const result = await service.create(customDto);

      expect(result.status).toBe(AppointmentStatus.PENDING);
      expect(result.notes).toBe('Corte degradado bajo con navaja');
      expect(result.source).toBe('WEB_APP');
    });
  });

  // =========================================================================
  // 2. FUNCIÓN: getAvailability()
  // =========================================================================
  describe('2. getAvailability() - Bucles anidados, generación de espacios disponibles y detección de colisiones', () => {
    const query: QueryAvailabilityDto = {
      barberId: 1,
      serviceId: 10,
      date: '2026-09-14', // Lunes
    };

    it('2.1 Debe lanzar NotFoundException si el barbero no existe o está inactivo', async () => {
      prisma.barber.findUnique.mockResolvedValue(null);

      await expect(service.getAvailability(query)).rejects.toThrow(
        new NotFoundException(`Barbero con ID ${query.barberId} no encontrado o inactivo`),
      );
    });

    it('2.2 Debe lanzar NotFoundException si el servicio no existe o está inactivo', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(service.getAvailability(query)).rejects.toThrow(
        new NotFoundException(`Servicio con ID ${query.serviceId} no encontrado o inactivo`),
      );
    });

    it('2.3 Debe retornar isWorkingDay: false y availableSlots vacío si el barbero no labora ese día', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService);
      prisma.barberSchedule.findMany.mockResolvedValue([]); // Sin horarios

      const result = await service.getAvailability(query);

      expect(result).toEqual({
        date: '2026-09-14',
        barber: { id: mockBarber.id, name: mockBarber.name },
        service: {
          id: mockService.id,
          name: mockService.name,
          duration: mockService.duration,
          price: mockService.price,
        },
        isWorkingDay: false,
        message: 'El barbero no atiende en esta fecha',
        availableSlots: [],
      });
    });

    it('2.4 Debe generar todos los slots mediante bucle cuando no hay colisiones con citas existentes', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService); // duration: 30
      // Horario de 9:00 AM (540m) a 10:30 AM (630m) -> 9:00, 9:30, 10:00 (3 slots)
      prisma.barberSchedule.findMany.mockResolvedValue([
        { id: 1, barberId: 1, dayOfWeek: 1, startMinute: 540, endMinute: 630 },
      ]);
      prisma.appointment.findMany.mockResolvedValue([]); // Ninguna cita existente

      const result = await service.getAvailability(query);

      expect(result.isWorkingDay).toBe(true);
      expect(result.totalSlotsAvailable).toBe(3);
      expect(result.availableSlots).toHaveLength(3);
      expect(result.availableSlots[0]).toMatchObject({
        time: '09:00',
        minute: 540,
      });
      expect(result.availableSlots[1]).toMatchObject({
        time: '09:30',
        minute: 570,
      });
      expect(result.availableSlots[2]).toMatchObject({
        time: '10:00',
        minute: 600,
      });
    });

    it('2.5 Debe detectar colisiones y filtrar slots ocupados por citas existentes', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService); // duration: 30
      // Horario de 9:00 AM (540m) a 11:00 AM (660m) -> normalmente 4 slots: 9:00, 9:30, 10:00, 10:30
      prisma.barberSchedule.findMany.mockResolvedValue([
        { id: 1, barberId: 1, dayOfWeek: 1, startMinute: 540, endMinute: 660 },
      ]);

      // Simulamos que a las 09:30 hay una cita agendada hasta las 10:00
      prisma.appointment.findMany.mockResolvedValue([
        {
          id: 5,
          startTime: new Date('2026-09-14T09:30:00-05:00'),
          endTime: new Date('2026-09-14T10:00:00-05:00'),
          status: AppointmentStatus.CONFIRMED,
        },
      ]);

      const result = await service.getAvailability(query);

      expect(result.isWorkingDay).toBe(true);
      expect(result.totalSlotsAvailable).toBe(3);
      // No debe existir el slot de las 09:30
      const times = result.availableSlots.map((s) => s.time);
      expect(times).toEqual(['09:00', '10:00', '10:30']);
      expect(times).not.toContain('09:30');
    });

    it('2.6 Debe respetar el stepMinutes personalizado para generar granularidad diferente', async () => {
      prisma.barber.findUnique.mockResolvedValue(mockBarber);
      prisma.service.findUnique.mockResolvedValue(mockService); // duration: 30
      // Horario de 9:00 AM (540m) a 10:00 AM (600m). Con step 15 min -> 9:00, 9:15, 9:30 (slots válidos)
      prisma.barberSchedule.findMany.mockResolvedValue([
        { id: 1, barberId: 1, dayOfWeek: 1, startMinute: 540, endMinute: 600 },
      ]);
      prisma.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailability({
        ...query,
        stepMinutes: 15,
      });

      const times = result.availableSlots.map((s) => s.time);
      expect(times).toEqual(['09:00', '09:15', '09:30']);
      expect(result.totalSlotsAvailable).toBe(3);
    });
  });

  // =========================================================================
  // 3. FUNCIÓN: findAll()
  // =========================================================================
  describe('3. findAll() - Combinaciones de filtros opcionales y condiciones sobre fechas', () => {
    it('3.1 Debe consultar sin filtros si params es undefined', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(prisma.appointment.findMany).toHaveBeenCalledWith({
        where: {},
        include: { client: true, barber: true, service: true },
        orderBy: { startTime: 'asc' },
      });
    });

    it('3.2 Debe consultar solo por barberId cuando se pasa únicamente barberId', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.findAll({ barberId: 2 });

      expect(prisma.appointment.findMany).toHaveBeenCalledWith({
        where: { barberId: 2 },
        include: { client: true, barber: true, service: true },
        orderBy: { startTime: 'asc' },
      });
    });

    it('3.3 Debe consultar solo por clientId y status cuando se suministran ambos', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      await service.findAll({ clientId: 15, status: AppointmentStatus.COMPLETED });

      expect(prisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          clientId: 15,
          status: AppointmentStatus.COMPLETED,
        },
        include: { client: true, barber: true, service: true },
        orderBy: { startTime: 'asc' },
      });
    });

    it('3.4 Debe aplicar condición gte sobre startTime cuando solo se envía "from"', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      const from = '2026-09-01T00:00:00Z';
      await service.findAll({ from });

      expect(prisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          startTime: {
            gte: new Date(from),
          },
        },
        include: { client: true, barber: true, service: true },
        orderBy: { startTime: 'asc' },
      });
    });

    it('3.5 Debe aplicar condición lte sobre startTime cuando solo se envía "to"', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      const to = '2026-09-30T23:59:59Z';
      await service.findAll({ to });

      expect(prisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          startTime: {
            lte: new Date(to),
          },
        },
        include: { client: true, barber: true, service: true },
        orderBy: { startTime: 'asc' },
      });
    });

    it('3.6 Debe combinar todos los filtros posibles (barberId, clientId, status, from, to)', async () => {
      prisma.appointment.findMany.mockResolvedValue([]);

      const filters = {
        barberId: 3,
        clientId: 8,
        status: AppointmentStatus.CONFIRMED,
        from: '2026-09-10T00:00:00Z',
        to: '2026-09-15T23:59:59Z',
      };

      await service.findAll(filters);

      expect(prisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          barberId: 3,
          clientId: 8,
          status: AppointmentStatus.CONFIRMED,
          startTime: {
            gte: new Date(filters.from),
            lte: new Date(filters.to),
          },
        },
        include: { client: true, barber: true, service: true },
        orderBy: { startTime: 'asc' },
      });
    });
  });

  // =========================================================================
  // 4. FUNCIÓN: updateStatus()
  // =========================================================================
  describe('4. updateStatus() - Actualización condicional, manejo de notas y propagación de excepciones', () => {
    const existingAppointment = {
      id: 25,
      barberId: 1,
      serviceId: 10,
      clientId: 50,
      status: AppointmentStatus.PENDING,
      notes: 'Nota previa',
    };

    it('4.1 Debe propagar NotFoundException si la cita no existe (originada en findOne)', async () => {
      prisma.appointment.findUnique.mockResolvedValue(null);

      const dto: UpdateAppointmentStatusDto = {
        status: AppointmentStatus.CONFIRMED,
      };

      await expect(service.updateStatus(999, dto)).rejects.toThrow(
        new NotFoundException('Cita con ID 999 no encontrada'),
      );
      expect(prisma.appointment.update).not.toHaveBeenCalled();
    });

    it('4.2 Debe actualizar únicamente el status si no se envían notas en el DTO', async () => {
      prisma.appointment.findUnique.mockResolvedValue(existingAppointment);
      const updatedMock = { ...existingAppointment, status: AppointmentStatus.COMPLETED };
      prisma.appointment.update.mockResolvedValue(updatedMock);

      const dto: UpdateAppointmentStatusDto = {
        status: AppointmentStatus.COMPLETED,
      };

      const result = await service.updateStatus(25, dto);

      expect(prisma.appointment.findUnique).toHaveBeenCalledWith({
        where: { id: 25 },
        include: { client: true, barber: true, service: true },
      });
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 25 },
        data: {
          status: AppointmentStatus.COMPLETED,
        },
        include: { client: true, barber: true, service: true },
      });
      expect(result.status).toBe(AppointmentStatus.COMPLETED);
    });

    it('4.3 Debe actualizar condicionalmente el status y las notas cuando dto.notes está presente', async () => {
      prisma.appointment.findUnique.mockResolvedValue(existingAppointment);
      const updatedMock = {
        ...existingAppointment,
        status: AppointmentStatus.CANCELLED,
        notes: 'Cliente canceló por viaje',
      };
      prisma.appointment.update.mockResolvedValue(updatedMock);

      const dto: UpdateAppointmentStatusDto = {
        status: AppointmentStatus.CANCELLED,
        notes: 'Cliente canceló por viaje',
      };

      const result = await service.updateStatus(25, dto);

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 25 },
        data: {
          status: AppointmentStatus.CANCELLED,
          notes: 'Cliente canceló por viaje',
        },
        include: { client: true, barber: true, service: true },
      });
      expect(result.notes).toBe('Cliente canceló por viaje');
      expect(result.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('4.4 Debe propagar errores no controlados si prisma.appointment.update arroja una excepción', async () => {
      prisma.appointment.findUnique.mockResolvedValue(existingAppointment);
      prisma.appointment.update.mockRejectedValue(new Error('Database disk full'));

      const dto: UpdateAppointmentStatusDto = {
        status: AppointmentStatus.COMPLETED,
      };

      await expect(service.updateStatus(25, dto)).rejects.toThrow('Database disk full');
    });
  });

  // =========================================================================
  // Métodos complementarios: findOne() y cancel()
  // =========================================================================
  describe('Métodos auxiliares: findOne() y cancel()', () => {
    const existingAppointment = {
      id: 25,
      barberId: 1,
      serviceId: 10,
      clientId: 50,
      status: AppointmentStatus.CONFIRMED,
      notes: 'Nota previa',
    };

    it('findOne() - Debe retornar la cita si existe', async () => {
      prisma.appointment.findUnique.mockResolvedValue(existingAppointment);

      const result = await service.findOne(25);
      expect(result).toEqual(existingAppointment);
    });

    it('cancel() - Debe cambiar status a CANCELLED y actualizar notas si se envían', async () => {
      prisma.appointment.findUnique.mockResolvedValue(existingAppointment);
      const cancelledMock = {
        ...existingAppointment,
        status: AppointmentStatus.CANCELLED,
        notes: 'Cancelado por usuario',
      };
      prisma.appointment.update.mockResolvedValue(cancelledMock);

      const result = await service.cancel(25, 'Cancelado por usuario');

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 25 },
        data: {
          status: AppointmentStatus.CANCELLED,
          notes: 'Cancelado por usuario',
        },
        include: { client: true, barber: true, service: true },
      });
      expect(result.status).toBe(AppointmentStatus.CANCELLED);
    });

    it('cancel() - Debe cambiar status a CANCELLED sin notas si no se proveen', async () => {
      prisma.appointment.findUnique.mockResolvedValue(existingAppointment);
      const cancelledMock = {
        ...existingAppointment,
        status: AppointmentStatus.CANCELLED,
      };
      prisma.appointment.update.mockResolvedValue(cancelledMock);

      const result = await service.cancel(25);

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 25 },
        data: {
          status: AppointmentStatus.CANCELLED,
        },
        include: { client: true, barber: true, service: true },
      });
      expect(result.status).toBe(AppointmentStatus.CANCELLED);
    });
  });
});
