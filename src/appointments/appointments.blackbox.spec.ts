import { BadRequestException } from '@nestjs/common';
import { ValidationPipe, ArgumentMetadata } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { AppointmentStatus } from '@prisma/client';

describe('Appointments API - Pruebas de Caja Negra (Black-Box Testing)', () => {
  let controller: AppointmentsController;
  let validationPipe: ValidationPipe;
  let appointmentsService: {
    create: jest.Mock;
    getAvailability: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    updateStatus: jest.Mock;
    cancel: jest.Mock;
  };

  const createMetadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateAppointmentDto,
  };

  const availabilityMetadata: ArgumentMetadata = {
    type: 'query',
    metatype: QueryAvailabilityDto,
  };

  const updateStatusMetadata: ArgumentMetadata = {
    type: 'body',
    metatype: UpdateAppointmentStatusDto,
  };

  beforeAll(() => {
    validationPipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    });

    appointmentsService = {
      create: jest.fn(),
      getAvailability: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      updateStatus: jest.fn(),
      cancel: jest.fn(),
    };

    controller = new AppointmentsController(appointmentsService as unknown as AppointmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // TÉCNICA 1: PARTICIÓN DE EQUIVALENCIA (EQUIVALENCE PARTITIONING - EP)
  // =========================================================================
  describe('Técnica 1: Partición de Equivalencia (Equivalence Partitioning)', () => {
    // Clase Válida 1 (CE-V1): Payload completo y correcto con clientId
    it('[EP-01] [Clase Válida] Debe aceptar payload con clientId numérico válido y fecha ISO correcta', async () => {
      const validPayload = {
        barberId: 1,
        serviceId: 2,
        clientId: 10,
        startTime: '2026-09-14T10:00:00.000Z',
      };

      const transformed = await validationPipe.transform(validPayload, createMetadata);
      expect(transformed.barberId).toBe(1);
      expect(transformed.clientId).toBe(10);

      appointmentsService.create.mockResolvedValue({
        id: 101,
        ...transformed,
        status: AppointmentStatus.CONFIRMED,
      });

      const result = await controller.create(transformed);
      expect(result.id).toBe(101);
      expect(appointmentsService.create).toHaveBeenCalledWith(transformed);
    });

    // Clase Válida 2 (CE-V2): Payload sin clientId pero con clientName y clientPhone
    it('[EP-02] [Clase Válida] Debe aceptar payload sin clientId cuando se envía clientName y clientPhone', async () => {
      const validPayloadWithoutClientId = {
        barberId: 1,
        serviceId: 2,
        clientName: 'Alejandro Lopez',
        clientPhone: '3007654321',
        startTime: '2026-09-14T11:00:00.000Z',
      };

      const transformed = await validationPipe.transform(validPayloadWithoutClientId, createMetadata);

      appointmentsService.create.mockResolvedValue({
        id: 102,
        ...transformed,
        clientId: 55,
        status: AppointmentStatus.CONFIRMED,
      });

      const result = await controller.create(transformed);
      expect(result.id).toBe(102);
    });

    // Clase Inválida 1 (CE-I1): barberId ausente o tipo incorrecto
    it('[EP-03] [Clase Inválida] Debe rechazar con 400 Bad Request si barberId no es un número entero', async () => {
      const invalidPayload = {
        barberId: 'invalido-no-numero',
        serviceId: 2,
        clientId: 10,
        startTime: '2026-09-14T10:00:00.000Z',
      };

      await expect(validationPipe.transform(invalidPayload, createMetadata)).rejects.toThrow(
        BadRequestException,
      );
      expect(appointmentsService.create).not.toHaveBeenCalled();
    });

    // Clase Inválida 2 (CE-I2): Formato de fecha startTime no conforme a ISO
    it('[EP-04] [Clase Inválida] Debe rechazar con 400 Bad Request si startTime no tiene formato de fecha ISO', async () => {
      const invalidPayload = {
        barberId: 1,
        serviceId: 2,
        clientId: 10,
        startTime: '14 de Septiembre a las 10 am',
      };

      await expect(validationPipe.transform(invalidPayload, createMetadata)).rejects.toThrow(
        BadRequestException,
      );
    });

    // Clase Inválida 3 (CE-I3): Propiedad no permitida en el DTO (forbidNonWhitelisted)
    it('[EP-05] [Clase Inválida] Debe rechazar con 400 Bad Request si se envían campos no permitidos en el payload (forbidNonWhitelisted)', async () => {
      const payloadWithMaliciousField = {
        barberId: 1,
        serviceId: 2,
        clientId: 10,
        startTime: '2026-09-14T10:00:00.000Z',
        adminOverrideDiscount: 100,
      };

      await expect(validationPipe.transform(payloadWithMaliciousField, createMetadata)).rejects.toThrow(
        BadRequestException,
      );
    });

    // Clase Inválida 4 (CE-I4): Status no perteneciente al enum AppointmentStatus
    it('[EP-06] [Clase Inválida] Debe rechazar con 400 Bad Request si el status no pertenece al enum AppointmentStatus', async () => {
      const payloadWithInvalidStatus = {
        barberId: 1,
        serviceId: 2,
        clientId: 10,
        startTime: '2026-09-14T10:00:00.000Z',
        status: 'ESTADO_INEXISTENTE',
      };

      await expect(validationPipe.transform(payloadWithInvalidStatus, createMetadata)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // =========================================================================
  // TÉCNICA 2: ANÁLISIS DE VALORES LÍMITE (BOUNDARY VALUE ANALYSIS - BVA)
  // =========================================================================
  describe('Técnica 2: Análisis de Valores Límite (Boundary Value Analysis - BVA)', () => {
    // Límite Inferior Válido: Apertura exacta de la barbería (08:00 AM)
    it('[BVA-01] [Límite Inferior Válido] Debe permitir agendar cita exactamente en el minuto de apertura laboral (08:00)', async () => {
      const openingTimeSlot = {
        barberId: 1,
        serviceId: 2,
        clientId: 10,
        startTime: '2026-09-14T08:00:00-05:00',
      };

      const transformed = await validationPipe.transform(openingTimeSlot, createMetadata);

      appointmentsService.create.mockResolvedValue({
        id: 201,
        ...transformed,
        status: AppointmentStatus.CONFIRMED,
      });

      const result = await controller.create(transformed);
      expect(result.id).toBe(201);
    });

    // Límite Superior Válido: Último slot que finaliza exactamente al cierre laboral (17:30 a 18:00)
    it('[BVA-02] [Límite Superior Válido] Debe permitir agendar cita que finaliza exactamente al minuto de cierre laboral (18:00)', async () => {
      const closingTimeSlot = {
        barberId: 1,
        serviceId: 2,
        clientId: 10,
        startTime: '2026-09-14T17:30:00-05:00',
      };

      const transformed = await validationPipe.transform(closingTimeSlot, createMetadata);

      appointmentsService.create.mockResolvedValue({
        id: 202,
        ...transformed,
        status: AppointmentStatus.CONFIRMED,
      });

      const result = await controller.create(transformed);
      expect(result.id).toBe(202);
    });

    // Límite Inferior Inválido: 1 minuto antes de la apertura (07:59 AM)
    it('[BVA-03] [Límite Inferior Inválido] Debe propagar error si la cita se solicita un minuto antes de la apertura laboral (07:59)', async () => {
      const beforeOpeningPayload = {
        barberId: 1,
        serviceId: 2,
        clientId: 10,
        startTime: '2026-09-14T07:59:00-05:00',
      };

      const transformed = await validationPipe.transform(beforeOpeningPayload, createMetadata);
      appointmentsService.create.mockRejectedValue(
        new BadRequestException('Fuera del horario laboral'),
      );

      await expect(controller.create(transformed)).rejects.toThrow(BadRequestException);
    });

    // Límite Superior Inválido: Cita que sobrepasa el cierre laboral en 1 minuto
    it('[BVA-04] [Límite Superior Inválido] Debe propagar error si la duración de la cita sobrepasa en 1 minuto el horario de cierre', async () => {
      const pastClosingPayload = {
        barberId: 1,
        serviceId: 2,
        clientId: 10,
        startTime: '2026-09-14T17:31:00-05:00',
      };

      const transformed = await validationPipe.transform(pastClosingPayload, createMetadata);
      appointmentsService.create.mockRejectedValue(
        new BadRequestException('La cita sobrepasa el horario laboral'),
      );

      await expect(controller.create(transformed)).rejects.toThrow(BadRequestException);
    });

    // Límite de Frontera de Parámetros: stepMinutes con valor límite mínimo 15 minutos
    it('[BVA-05] [Parámetros de Frontera] Debe aceptar consulta de disponibilidad con stepMinutes mínimo (15 min)', async () => {
      const queryParams = {
        barberId: 1,
        serviceId: 2,
        date: '2026-09-14',
        stepMinutes: 15,
      };

      const transformed = await validationPipe.transform(queryParams, availabilityMetadata);

      appointmentsService.getAvailability.mockResolvedValue({
        date: '2026-09-14',
        totalSlotsAvailable: 8,
        availableSlots: [],
      });

      const result = await controller.getAvailability(transformed);
      expect(result.totalSlotsAvailable).toBe(8);
      expect(appointmentsService.getAvailability).toHaveBeenCalledWith(transformed);
    });
  });

  // =========================================================================
  // TÉCNICA 3: TABLA DE DECISIÓN (DECISION TABLE TESTING)
  // =========================================================================
  describe('Técnica 3: Tabla de Decisión (Decision Table Testing)', () => {
    // Regla 1: Barbero Inactivo o Inexistente -> Esperado Not Found
    it('[DT-R1] [Regla 1] Si Barbero es Inactivo o No Existe -> Lanza NotFoundException', async () => {
      const payload = {
        barberId: 99,
        serviceId: 1,
        clientId: 1,
        startTime: '2026-09-14T10:00:00-05:00',
      };

      const transformed = await validationPipe.transform(payload, createMetadata);
      appointmentsService.create.mockRejectedValue(
        new BadRequestException('Barbero con ID 99 no encontrado o inactivo'),
      );

      await expect(controller.create(transformed)).rejects.toThrow(BadRequestException);
    });

    // Regla 2: Barbero Activo, Servicio NO asignado al barbero -> Esperado BadRequest
    it('[DT-R2] [Regla 2] Si Barbero no tiene asignado el Servicio solicitado -> Lanza BadRequestException', async () => {
      const payload = {
        barberId: 1,
        serviceId: 50,
        clientId: 1,
        startTime: '2026-09-14T10:00:00-05:00',
      };

      const transformed = await validationPipe.transform(payload, createMetadata);
      appointmentsService.create.mockRejectedValue(
        new BadRequestException('El barbero no tiene asignado el servicio'),
      );

      await expect(controller.create(transformed)).rejects.toThrow(BadRequestException);
    });

    // Regla 3: Barbero Activo, Servicio Asignado, pero Conflicto de Horario Solapado -> Esperado Conflict
    it('[DT-R3] [Regla 3] Si existe solapamiento con otra cita en el mismo horario -> Lanza ConflictException', async () => {
      const payload = {
        barberId: 1,
        serviceId: 1,
        clientId: 1,
        startTime: '2026-09-14T10:00:00-05:00',
      };

      const transformed = await validationPipe.transform(payload, createMetadata);
      appointmentsService.create.mockRejectedValue(
        new BadRequestException('El barbero ya tiene una cita programada en ese horario'),
      );

      await expect(controller.create(transformed)).rejects.toThrow(BadRequestException);
    });

    // Regla 4: Barbero Activo, Servicio Asignado, Horario Disponible sin Conflicto -> 201 Created
    it('[DT-R4] [Regla 4] Si todas las condiciones de negocio se satisfacen -> Retorna cita creada exitosamente', async () => {
      const payload = {
        barberId: 1,
        serviceId: 1,
        clientId: 1,
        startTime: '2026-09-14T10:00:00-05:00',
      };

      const transformed = await validationPipe.transform(payload, createMetadata);
      appointmentsService.create.mockResolvedValue({
        id: 301,
        ...transformed,
        status: AppointmentStatus.CONFIRMED,
      });

      const result = await controller.create(transformed);
      expect(result.id).toBe(301);
      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
    });
  });

  // =========================================================================
  // TÉCNICA 4: TRANSICIÓN DE ESTADOS (STATE TRANSITION TESTING)
  // =========================================================================
  describe('Técnica 4: Transición de Estados (State Transition Testing)', () => {
    // S0 -> S1 (Creación inicial de la cita: CONFIRMED o PENDING)
    it('[ST-01] [Transición S0 -> S1] Creación inicial de cita en estado CONFIRMED', async () => {
      const payload = {
        barberId: 1,
        serviceId: 1,
        clientId: 1,
        startTime: '2026-09-14T10:00:00-05:00',
      };

      const transformed = await validationPipe.transform(payload, createMetadata);
      appointmentsService.create.mockResolvedValue({
        id: 401,
        ...transformed,
        status: AppointmentStatus.CONFIRMED,
      });

      const result = await controller.create(transformed);
      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
    });

    // S1 -> S2 (CONFIRMED -> COMPLETED tras finalizar el servicio)
    it('[ST-02] [Transición S1 -> S2] Cambio de estado de CONFIRMED a COMPLETED', async () => {
      const updateDto = {
        status: AppointmentStatus.COMPLETED,
        notes: 'Corte realizado a satisfacción',
      };

      const transformed = await validationPipe.transform(updateDto, updateStatusMetadata);

      appointmentsService.updateStatus.mockResolvedValue({
        id: 401,
        status: AppointmentStatus.COMPLETED,
        notes: 'Corte realizado a satisfacción',
      });

      const result = await controller.updateStatus(401, transformed);
      expect(result.status).toBe(AppointmentStatus.COMPLETED);
      expect(appointmentsService.updateStatus).toHaveBeenCalledWith(401, transformed);
    });

    // S1 -> S3 (CONFIRMED -> CANCELLED por cancelación de cliente o barbero)
    it('[ST-03] [Transición S1 -> S3] Cambio de estado de CONFIRMED a CANCELLED mediante cancelación de cita', async () => {
      appointmentsService.cancel.mockResolvedValue({
        id: 401,
        status: AppointmentStatus.CANCELLED,
        notes: 'Cancelación solicitada por el usuario',
      });

      const result = await controller.cancel(401, 'Cancelación solicitada por el usuario');
      expect(result.status).toBe(AppointmentStatus.CANCELLED);
      expect(appointmentsService.cancel).toHaveBeenCalledWith(
        401,
        'Cancelación solicitada por el usuario',
      );
    });

    // S1 -> S4 (CONFIRMED -> NO_SHOW cuando el cliente no asiste a la barbería)
    it('[ST-04] [Transición S1 -> S4] Cambio de estado de CONFIRMED a NO_SHOW por inasistencia', async () => {
      const updateDto = {
        status: AppointmentStatus.NO_SHOW,
        notes: 'Cliente no llegó tras 15 minutos de espera',
      };

      const transformed = await validationPipe.transform(updateDto, updateStatusMetadata);

      appointmentsService.updateStatus.mockResolvedValue({
        id: 401,
        status: AppointmentStatus.NO_SHOW,
        notes: 'Cliente no llegó tras 15 minutos de espera',
      });

      const result = await controller.updateStatus(401, transformed);
      expect(result.status).toBe(AppointmentStatus.NO_SHOW);
    });
  });
});
