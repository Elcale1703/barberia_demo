import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class AppointmentsService {
  // Zona horaria por defecto de la barbería (Colombia UTC-5)
  private readonly timezone = process.env.TIMEZONE || 'America/Bogota';

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
  ) {}

  /**
   * Helper para obtener el día de la semana (0=Domingo..6=Sábado) y minutos desde medianoche
   * en la zona horaria del negocio.
   */
  private getTimezoneDetails(date: Date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

    const weekdayStr = getPart('weekday');
    const hour = parseInt(getPart('hour'), 10);
    const minute = parseInt(getPart('minute'), 10);

    const weekdaysMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const dayOfWeek = weekdaysMap[weekdayStr] ?? date.getDay();
    const minuteOfDay = hour * 60 + minute;

    return { dayOfWeek, minuteOfDay };
  }

  /**
   * Helper para convertir fecha 'YYYY-MM-DD' y minutos desde medianoche a objeto Date
   */
  private dateFromMinutes(dateStr: string, minutes: number): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    // Formatear como ISO con offset de Colombia (-05:00)
    const pad = (n: number) => String(n).padStart(2, '0');
    const isoString = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(mins)}:00-05:00`;
    return new Date(isoString);
  }

  async create(dto: CreateAppointmentDto) {
    // 1. Validar barbero
    const barber = await this.prisma.barber.findUnique({
      where: { id: dto.barberId },
    });
    if (!barber || !barber.active) {
      throw new NotFoundException(`Barbero con ID ${dto.barberId} no encontrado o inactivo`);
    }

    // 2. Validar servicio
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service || !service.active) {
      throw new NotFoundException(`Servicio con ID ${dto.serviceId} no encontrado o inactivo`);
    }

    // 3. Validar que el barbero preste este servicio
    const barberService = await this.prisma.barberService.findUnique({
      where: {
        barberId_serviceId: {
          barberId: dto.barberId,
          serviceId: dto.serviceId,
        },
      },
    });
    if (!barberService) {
      throw new BadRequestException(
        `El barbero ${barber.name} no tiene asignado el servicio "${service.name}"`,
      );
    }

    // 4. Obtener o crear cliente
    let clientId = dto.clientId;
    if (!clientId) {
      if (!dto.clientName || !dto.clientPhone) {
        throw new BadRequestException(
          'Debe proveer un clientId existente o el nombre y teléfono del cliente (clientName y clientPhone)',
        );
      }
      const client = await this.clientsService.findOrCreateByPhone(
        dto.clientName,
        dto.clientPhone,
        dto.clientEmail,
      );
      clientId = client.id;
    } else {
      const existingClient = await this.prisma.client.findUnique({
        where: { id: clientId },
      });
      if (!existingClient) {
        throw new NotFoundException(`Cliente con ID ${clientId} no encontrado`);
      }
    }

    // 5. Validar fecha y duración
    const startTime = new Date(dto.startTime);
    if (isNaN(startTime.getTime())) {
      throw new BadRequestException('Formato de fecha inválido para startTime');
    }

    const endTime = new Date(startTime.getTime() + service.duration * 60000);

    // 6. Validar horario de trabajo del barbero
    const { dayOfWeek, minuteOfDay: startMinute } = this.getTimezoneDetails(startTime);
    const endMinute = startMinute + service.duration;

    const schedules = await this.prisma.barberSchedule.findMany({
      where: {
        barberId: dto.barberId,
        dayOfWeek,
      },
    });

    if (schedules.length === 0) {
      throw new BadRequestException(
        `El barbero ${barber.name} no labora en este día de la semana`,
      );
    }

    const isWithinSchedule = schedules.some(
      (s) => startMinute >= s.startMinute && endMinute <= s.endMinute,
    );

    if (!isWithinSchedule) {
      throw new BadRequestException(
        `La cita solicitada (${startMinute}m - ${endMinute}m) está fuera del horario laboral del barbero para este día`,
      );
    }

    // 7. Validar colisiones / solapamiento con citas existentes
    const overlappingAppointment = await this.prisma.appointment.findFirst({
      where: {
        barberId: dto.barberId,
        status: {
          not: AppointmentStatus.CANCELLED,
        },
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: startTime } },
        ],
      },
      include: {
        client: true,
      },
    });

    if (overlappingAppointment) {
      throw new ConflictException(
        `El barbero ya tiene una cita programada en ese horario (de ${overlappingAppointment.startTime.toISOString()} a ${overlappingAppointment.endTime.toISOString()})`,
      );
    }

    // 8. Crear la cita
    return this.prisma.appointment.create({
      data: {
        barberId: dto.barberId,
        serviceId: dto.serviceId,
        clientId,
        startTime,
        endTime,
        status: dto.status ?? AppointmentStatus.CONFIRMED,
        notes: dto.notes,
        source: dto.source ?? 'VAPI',
      },
      include: {
        client: true,
        barber: true,
        service: true,
      },
    });
  }

  /**
   * Consulta los espacios libres de atención de un barbero para una fecha específica
   */
  async getAvailability(query: QueryAvailabilityDto) {
    const { barberId, serviceId, date } = query;

    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
    });
    if (!barber || !barber.active) {
      throw new NotFoundException(`Barbero con ID ${barberId} no encontrado o inactivo`);
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service || !service.active) {
      throw new NotFoundException(`Servicio con ID ${serviceId} no encontrado o inactivo`);
    }

    // Obtener día de la semana para la fecha consultada (ej. '2026-09-15')
    const sampleDate = this.dateFromMinutes(date, 720); // Mediodía
    const { dayOfWeek } = this.getTimezoneDetails(sampleDate);

    // Obtener horarios laborales del barbero ese día
    const schedules = await this.prisma.barberSchedule.findMany({
      where: { barberId, dayOfWeek },
      orderBy: { startMinute: 'asc' },
    });

    if (schedules.length === 0) {
      return {
        date,
        barber: { id: barber.id, name: barber.name },
        service: { id: service.id, name: service.name, duration: service.duration, price: service.price },
        isWorkingDay: false,
        message: 'El barbero no atiende en esta fecha',
        availableSlots: [],
      };
    }

    // Definir límites del día para buscar citas
    const dayStart = this.dateFromMinutes(date, 0);
    const dayEnd = this.dateFromMinutes(date, 1440);

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        barberId,
        status: { not: AppointmentStatus.CANCELLED },
        startTime: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { startTime: 'asc' },
    });

    const step = query.stepMinutes || 30; // Granularidad de horarios (ej. cada 30 min)
    const duration = service.duration;
    const availableSlots: Array<{
      time: string;
      startTime: string;
      endTime: string;
      minute: number;
    }> = [];

    for (const schedule of schedules) {
      for (
        let minute = schedule.startMinute;
        minute + duration <= schedule.endMinute;
        minute += step
      ) {
        const slotStart = this.dateFromMinutes(date, minute);
        const slotEnd = this.dateFromMinutes(date, minute + duration);

        // Verificar si se solapa con alguna cita existente
        const hasCollision = existingAppointments.some((app) => {
          return slotStart < app.endTime && slotEnd > app.startTime;
        });

        if (!hasCollision) {
          const hour = Math.floor(minute / 60);
          const min = minute % 60;
          const pad = (n: number) => String(n).padStart(2, '0');
          const timeFormatted = `${pad(hour)}:${pad(min)}`;

          availableSlots.push({
            time: timeFormatted,
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            minute,
          });
        }
      }
    }

    return {
      date,
      barber: { id: barber.id, name: barber.name },
      service: { id: service.id, name: service.name, duration: service.duration, price: service.price },
      isWorkingDay: true,
      totalSlotsAvailable: availableSlots.length,
      availableSlots,
    };
  }

  async findAll(params?: {
    barberId?: number;
    clientId?: number;
    status?: AppointmentStatus;
    from?: string;
    to?: string;
  }) {
    const where: any = {};

    if (params?.barberId) where.barberId = params.barberId;
    if (params?.clientId) where.clientId = params.clientId;
    if (params?.status) where.status = params.status;

    if (params?.from || params?.to) {
      where.startTime = {};
      if (params.from) where.startTime.gte = new Date(params.from);
      if (params.to) where.startTime.lte = new Date(params.to);
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        client: true,
        barber: true,
        service: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        barber: true,
        service: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException(`Cita con ID ${id} no encontrada`);
    }

    return appointment;
  }

  async updateStatus(id: number, dto: UpdateAppointmentStatusDto) {
    await this.findOne(id);

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.notes ? { notes: dto.notes } : {}),
      },
      include: {
        client: true,
        barber: true,
        service: true,
      },
    });
  }

  async cancel(id: number, notes?: string) {
    await this.findOne(id);

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        ...(notes ? { notes } : {}),
      },
      include: {
        client: true,
        barber: true,
        service: true,
      },
    });
  }
}
