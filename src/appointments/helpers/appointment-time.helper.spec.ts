import {
  DEFAULT_TIMEZONE,
  getTimezoneDetails,
  dateFromMinutes,
  formatMinutesToTime,
} from './appointment-time.helper';

describe('appointment-time.helper', () => {
  describe('DEFAULT_TIMEZONE', () => {
    it('debe tener definido un timezone por defecto', () => {
      expect(DEFAULT_TIMEZONE).toBeDefined();
    });
  });

  describe('getTimezoneDetails', () => {
    it('debe retornar dayOfWeek y minuteOfDay para una fecha dada en Bogota', () => {
      // 2026-09-14 es Lunes (dayOfWeek = 1). 09:30 AM = 9*60 + 30 = 570 minutos
      const date = new Date('2026-09-14T09:30:00-05:00');
      const details = getTimezoneDetails(date, 'America/Bogota');

      expect(details.dayOfWeek).toBe(1);
      expect(details.minuteOfDay).toBe(570);
    });

    it('debe funcionar con el timezone por defecto omitido', () => {
      const date = new Date('2026-09-14T14:00:00-05:00');
      const details = getTimezoneDetails(date);

      expect(details.dayOfWeek).toBe(1);
      expect(details.minuteOfDay).toBe(840);
    });

    it('debe calcular correctamente los días domingo y sábado', () => {
      // 2026-09-13 es Domingo (0)
      const sunday = new Date('2026-09-13T10:00:00-05:00');
      expect(getTimezoneDetails(sunday).dayOfWeek).toBe(0);

      // 2026-09-19 es Sábado (6)
      const saturday = new Date('2026-09-19T10:00:00-05:00');
      expect(getTimezoneDetails(saturday).dayOfWeek).toBe(6);
    });
  });

  describe('dateFromMinutes', () => {
    it('debe construir un objeto Date correspondiente al minuto indicado', () => {
      const dateStr = '2026-09-14';
      const minutes = 540; // 09:00 AM
      const date = dateFromMinutes(dateStr, minutes);

      expect(date).toBeInstanceOf(Date);
      const details = getTimezoneDetails(date, 'America/Bogota');
      expect(details.minuteOfDay).toBe(540);
    });
  });

  describe('formatMinutesToTime', () => {
    it('debe formatear minutos a cadena HH:mm con ceros a la izquierda', () => {
      expect(formatMinutesToTime(0)).toBe('00:00');
      expect(formatMinutesToTime(540)).toBe('09:00');
      expect(formatMinutesToTime(635)).toBe('10:35');
      expect(formatMinutesToTime(1439)).toBe('23:59');
    });
  });
});
