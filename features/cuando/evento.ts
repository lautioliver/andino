// El evento de calendario de «Avisame esta noche»: los datos, sin formato de salida. Lo arma recordatorio.ts
// y lo escriben ics.ts (el archivo .ics) y google.ts (el enlace a Google Calendar): una sola fuente para los dos.

export interface EventoDeCalendario {
  /** Identificador estable: bajar dos veces el mismo recordatorio no duplica el evento. */
  uid: string;
  /** Instantes en milisegundos desde la época; las dos salidas los escriben en UTC (terminados en Z). */
  creado: number;
  inicio: number;
  fin: number;
  /** Minutos antes del inicio en que avisa la alarma. Solo viaja en el .ics: un enlace a Google Calendar no puede fijarla. */
  alarmaMin: number;
  titulo: string;
  descripcion: string;
  lugar: string;
  geo: { latitude: number; longitude: number };
  url: string;
}
