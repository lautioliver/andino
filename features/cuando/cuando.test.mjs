// Tests de «Cuándo», la mejor noche del viaje: `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jornada } from "../cielo/jornada.ts";
import { computeSky, sunAltitudeDeg } from "../cielo/motor.ts";
import { lineaDeLaNoche } from "../pacha/linea.ts";
import {
  ALGO_NUBLADO_HASTA,
  DESPEJADO_HASTA,
  estadoDelCielo,
  faseDeLaLuna,
  fechasDesde,
  hora,
  inicioDelCielo,
  leerOpenMeteo,
  LUNA_FINA,
  mejorNoche,
  nocheDeCielo,
  nubosidadMedia,
  puntaje,
  tramoMasLargo,
  ventanaDeNubes,
} from "./cuando.ts";

const PURMAMARCA = { latitude: -23.7333, longitude: -65.4833 };
const minutos = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000;

/** Pronóstico de mentira: `horas` horas desde `desde` (ISO), con el % que diga `nubes(ms)`. */
function pronostico(desde, horas, nubes) {
  const base = new Date(desde).getTime();
  return { desde: new Date(base).toISOString(), porHora: Array.from({ length: horas }, (_, i) => nubes(base + i * 3_600_000)) };
}
const entre = (ms, desde, hasta) => ms >= new Date(desde).getTime() && ms < new Date(hasta).getTime();

describe("una noche", () => {
  it("con Luna casi llena toda la noche (22/11/2026) no hay franja oscura", () => {
    const n = nocheDeCielo(PURMAMARCA, "2026-11-22");
    assert.equal(n.minutosOscuros, 0);
    assert.equal(n.franja, null);
    assert.ok(n.lunaIluminada > 0.95);
  });

  it("la noche cerrada es el minuto en que cae la de jornada.ts", () => {
    for (const fecha of ["2026-11-22", "2026-12-07"]) {
      const n = nocheDeCielo(PURMAMARCA, fecha);
      const j = jornada(PURMAMARCA, fecha);
      assert.ok(minutos(n.nocheCerrada, j.nocheCerrada) < 1, `${fecha}: ${n.nocheCerrada} vs ${j.nocheCerrada}`);
    }
  });

  it("con Luna menguante (29/11) la franja termina cuando sale la Luna", () => {
    const n = nocheDeCielo(PURMAMARCA, "2026-11-29");
    const sale = jornada(PURMAMARCA, "2026-11-29").luna.sale;
    assert.ok(n.franja, "no hubo franja");
    assert.equal(n.franja.desde, n.nocheCerrada);
    assert.ok(minutos(n.franja.hasta, sale) < 1, `${n.franja.hasta} vs salida ${sale}`);
  });

  it("en el medio de la franja el Sol está bajo −18° y la Luna bajo el horizonte (contra motor.ts)", () => {
    for (const fecha of ["2026-11-29", "2026-12-03", "2026-12-14"]) {
      const { franja } = nocheDeCielo(PURMAMARCA, fecha);
      const medio = new Date((new Date(franja.desde).getTime() + new Date(franja.hasta).getTime()) / 2).toISOString();
      assert.ok(sunAltitudeDeg(PURMAMARCA, medio) < -18, `${fecha}: Sol`);
      const luna = computeSky(PURMAMARCA, medio).find((o) => o.id === "luna");
      assert.equal(luna.isAboveHorizon, false, `${fecha}: Luna a ${luna.altitudeDeg}°`);
    }
  });

  it("con Luna creciente (14/12) la franja empieza cuando se pone la Luna y llega al alba", () => {
    const n = nocheDeCielo(PURMAMARCA, "2026-12-14");
    const sePone = jornada(PURMAMARCA, "2026-12-14").luna.sePone;
    assert.ok(minutos(n.franja.desde, sePone) < 1, `${n.franja.desde} vs puesta ${sePone}`);
    assert.equal(n.franja.hasta, n.alba);
  });

  it("los minutos oscuros nunca superan la noche astronómica", () => {
    for (const fecha of fechasDesde("2026-11-22", 30)) {
      const n = nocheDeCielo(PURMAMARCA, fecha);
      assert.ok(n.minutosOscuros <= minutos(n.nocheCerrada, n.alba), fecha);
    }
  });

  it("donde no oscurece del todo devuelve null en vez de inventar horas", () => {
    // Ushuaia en el solsticio: el Sol no baja de −18°.
    const n = nocheDeCielo({ latitude: -54.8, longitude: -68.3 }, "2026-12-21");
    assert.equal(n.nocheCerrada, null);
    assert.equal(n.alba, null);
    assert.equal(n.minutosOscuros, 0);
    assert.equal(n.franja, null);
  });
});

describe("las horas de una noche, contra la línea de tiempo de la portada", () => {
  // La portada muestra las dos cosas juntas: la línea de tiempo (linea.ts busca el instante exacto con
  // astronomy-engine y NocheDePortada lo escribe con este formato, que no redondea) y las horas de «Cuándo».
  const formato = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Jujuy", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  // La búsqueda de astronomy-engine tiene 0,1 s de tolerancia: si el instante cae a menos de eso de un
  // minuto en punto, el minuto que muestra la línea de tiempo puede ser el vecino. En dos años de noches
  // de las siete paradas pasa una vez: el alba del 5/2/2026 en Maimará (05:42:59,99).
  const alFilo = (iso) => {
    const segundos = (Date.parse(iso) / 1000) % 60;
    return segundos < 0.1 || segundos > 59.9;
  };

  it("en todas las paradas, cada hora es la del mismo hecho en la línea de tiempo: cielo oscuro, alba, puesta y salida de la Luna", async () => {
    const { places } = await import("../../data/places.ts");
    const comparadas = { oscuro: 0, alba: 0, "puesta-luna": 0, "salida-luna": 0 };
    for (const place of places) {
      for (const fecha of fechasDesde("2026-11-22", 60)) {
        const linea = lineaDeLaNoche(place, fecha);
        const n = nocheDeCielo(place, fecha);
        const igual = (deCuando, tipo) => {
          const evento = linea.eventos.find((e) => e.tipo === tipo);
          assert.ok(evento, `${place.id} ${fecha}: la línea de tiempo no tiene «${tipo}» y «Cuándo» da ${deCuando}`);
          comparadas[tipo]++;
          if (alFilo(evento.iso)) return;
          assert.equal(hora(deCuando), formato.format(new Date(evento.iso)), `${place.id} ${fecha}, ${tipo}: ${deCuando} contra ${evento.iso}`);
        };
        igual(n.nocheCerrada, "oscuro");
        igual(n.alba, "alba");
        if (!n.franja) continue;
        // La franja empieza al cerrarse la noche o cuando se pone la Luna, y termina al alba o cuando sale.
        if (n.franja.desde !== n.nocheCerrada) igual(n.franja.desde, "puesta-luna");
        if (n.franja.hasta !== n.alba) igual(n.franja.hasta, "salida-luna");
      }
    }
    // Que el caso no se quede sin lo que compara: hay bordes de las cuatro clases.
    for (const [tipo, veces] of Object.entries(comparadas)) assert.ok(veces >= places.length * 10, `${tipo}: ${veces} comparaciones`);
  });

  it("los minutos oscuros son la duración de la franja que se muestra", () => {
    const noches = fechasDesde("2026-11-22", 30).map((fecha) => nocheDeCielo(PURMAMARCA, fecha));
    for (const n of noches) {
      const deLaFranja = n.franja ? minutos(n.franja.desde, n.franja.hasta) : 0;
      assert.equal(n.minutosOscuros, deLaFranja, n.fecha);
      assert.ok(Number.isInteger(n.minutosOscuros), `${n.fecha}: ${n.minutosOscuros}`);
    }
    assert.ok(noches.filter((n) => n.franja).length > 20, "este caso necesita noches con franja");
  });

  it("22/11 en Purmamarca: noche cerrada 21:14 y alba 05:02, como la línea de tiempo (no 21:15 y 05:05)", () => {
    const n = nocheDeCielo(PURMAMARCA, "2026-11-22");
    assert.equal(n.nocheCerrada, "2026-11-22T21:14:00-03:00");
    assert.equal(n.alba, "2026-11-23T05:02:00-03:00");
    assert.deepEqual(ventanaDeNubes(n), { desde: "2026-11-22T21:14:00-03:00", hasta: "2026-11-23T05:02:00-03:00" });
  });
});

describe("la mejor noche del viaje", () => {
  it("entre 22/11 y 15/12 elige una noche de Luna casi nueva y no la de Luna llena", () => {
    const { noches, mejor } = mejorNoche(PURMAMARCA, fechasDesde("2026-11-22", 24));
    assert.equal(noches.length, 24);
    // Del 5 al 11/12 la Luna es tan fina que toda la noche cuenta como oscura. Al minuto esas noches ya
    // no empatan (se acortan hacia el solsticio): gana la más larga, la del 5 (455 min), y no la de Luna nueva del 8 (453).
    assert.equal(mejor.fecha, "2026-12-05");
    assert.ok(mejor.lunaIluminada < LUNA_FINA, `${mejor.fecha}: ${mejor.lunaIluminada}`);
    assert.ok(noches.every((n) => n.minutosOscuros <= mejor.minutosOscuros));
  });

  it("en un viaje de una semana con Luna menguando, la mejor es la última noche", () => {
    const { mejor } = mejorNoche(PURMAMARCA, fechasDesde("2026-11-24", 7));
    assert.equal(mejor.fecha, "2026-11-30");
  });

  it("si empatan en minutos, gana la de Luna más fina", () => {
    // 6 y 7/12: las dos con 454 minutos oscuros; la del 7 tiene la Luna más fina.
    const { noches, mejor } = mejorNoche(PURMAMARCA, fechasDesde("2026-12-06", 2));
    assert.equal(new Set(noches.map((n) => n.minutosOscuros)).size, 1, "este caso necesita un empate");
    assert.equal(mejor.fecha, "2026-12-07");
  });

  it("sin noches oscuras no hay mejor", () => {
    assert.equal(mejorNoche(PURMAMARCA, fechasDesde("2026-11-22", 3)).mejor, null);
    assert.equal(mejorNoche(PURMAMARCA, []).mejor, null);
  });
});

describe("utilidades", () => {
  it("tramoMasLargo elige el tramo más largo, no el primero, e incluye el que llega al final", () => {
    const [V, F] = [true, false];
    assert.deepEqual(tramoMasLargo([V, F, V, V, F]), { desde: 2, hasta: 4 });
    assert.deepEqual(tramoMasLargo([F, V, F, V, V, V]), { desde: 3, hasta: 6 });
    assert.deepEqual(tramoMasLargo([V, V, F, V, V]), { desde: 0, hasta: 2 });
    assert.equal(tramoMasLargo([F, F]), null);
    assert.equal(tramoMasLargo([]), null);
  });

  it("fechasDesde cruza meses y años", () => {
    assert.deepEqual(fechasDesde("2026-12-30", 3), ["2026-12-30", "2026-12-31", "2027-01-01"]);
  });
  it("hora da HH:MM en UTC−3", () => {
    assert.equal(hora("2026-11-30T01:35:00-03:00"), "01:35");
    assert.equal(hora("2026-11-30T04:35:00.000Z"), "01:35");
  });
});

describe("las nubes del pronóstico", () => {
  // La forma real de https://api.open-meteo.com/v1/forecast?…&hourly=cloud_cover&timezone=UTC (recortada).
  const respuesta = (hourly, extra = {}) => ({
    latitude: -23.725836,
    longitude: -65.48047,
    utc_offset_seconds: 0,
    timezone: "GMT",
    hourly_units: { time: "iso8601", cloud_cover: "%" },
    hourly,
    ...extra,
  });
  const HORAS = ["2026-11-21T00:00", "2026-11-21T01:00", "2026-11-21T02:00"];

  it("leerOpenMeteo deja la primera hora en UTC y un % por hora", () => {
    assert.deepEqual(leerOpenMeteo(respuesta({ time: HORAS, cloud_cover: [2, 0, 87] })), {
      desde: "2026-11-21T00:00:00.000Z",
      porHora: [2, 0, 87],
    });
  });

  it("leerOpenMeteo deja en null los valores que no son un % válido, sin correr los demás", () => {
    const horas = Array.from({ length: 7 }, (_, i) => `2026-11-21T0${i}:00`);
    const leido = leerOpenMeteo(respuesta({ time: horas, cloud_cover: [50, null, -1, 101, "7", 100, 0] }));
    assert.deepEqual(leido.porHora, [50, null, null, null, null, 100, 0]);
  });

  it("leerOpenMeteo devuelve null si las horas no están en UTC", () => {
    assert.equal(leerOpenMeteo(respuesta({ time: HORAS, cloud_cover: [2, 0, 87] }, { utc_offset_seconds: -10800 })), null);
  });

  it("leerOpenMeteo devuelve null si faltan valores o sobran", () => {
    assert.equal(leerOpenMeteo(respuesta({ time: HORAS, cloud_cover: [2, 0] })), null);
    assert.equal(leerOpenMeteo(respuesta({ time: HORAS.slice(0, 2), cloud_cover: [2, 0, 87] })), null);
  });

  it("leerOpenMeteo devuelve null si las horas saltan o no son horas en punto", () => {
    assert.equal(leerOpenMeteo(respuesta({ time: ["2026-11-21T00:00", "2026-11-21T02:00"], cloud_cover: [2, 0] })), null);
    assert.equal(leerOpenMeteo(respuesta({ time: ["2026-11-21T00:30", "2026-11-21T01:30"], cloud_cover: [2, 0] })), null);
    assert.equal(leerOpenMeteo(respuesta({ time: ["ayer", "hoy"], cloud_cover: [2, 0] })), null);
  });

  it("leerOpenMeteo devuelve null si no hay ningún dato o la respuesta es otra cosa", () => {
    assert.equal(leerOpenMeteo(respuesta({ time: HORAS, cloud_cover: [null, null, null] })), null);
    assert.equal(leerOpenMeteo(respuesta({ time: [], cloud_cover: [] })), null);
    for (const otra of [null, undefined, "texto", 7, [], {}, { hourly: {} }, { error: true, reason: "Latitude must be in range of -90 to 90°." }]) {
      assert.equal(leerOpenMeteo(otra), null, JSON.stringify(otra));
    }
  });

  it("leerOpenMeteo devuelve null si vienen muchas más horas que las de un pronóstico", () => {
    const base = Date.UTC(2026, 10, 21);
    const horas = (n) => Array.from({ length: n }, (_, i) => new Date(base + i * 3_600_000).toISOString().slice(0, 16));
    assert.equal(leerOpenMeteo(respuesta({ time: horas(17 * 24), cloud_cover: Array(17 * 24).fill(10) })).porHora.length, 17 * 24);
    assert.equal(leerOpenMeteo(respuesta({ time: horas(40 * 24), cloud_cover: Array(40 * 24).fill(10) })), null);
  });

  const cuatroHoras = { desde: "2026-11-29T00:00:00.000Z", porHora: [0, 100, 40, null] };
  const t = (hhmm) => Date.parse(`2026-11-29T${hhmm}:00Z`);

  it("nubosidadMedia pesa cada hora por los minutos que entran en el tramo", () => {
    assert.equal(nubosidadMedia(cuatroHoras, t("00:00"), t("01:00")), 0);
    assert.equal(nubosidadMedia(cuatroHoras, t("00:00"), t("02:00")), 50);
    // 15 minutos de 0 % y 60 de 100 %.
    assert.equal(nubosidadMedia(cuatroHoras, t("00:45"), t("02:00")), 80);
    // 30 minutos de 100 % y 30 de 40 %.
    assert.equal(nubosidadMedia(cuatroHoras, t("01:30"), t("02:30")), 70);
  });

  it("nubosidadMedia no pide la hora siguiente si el tramo termina en punto", () => {
    assert.equal(nubosidadMedia(cuatroHoras, t("02:00"), t("03:00")), 40);
  });

  it("nubosidadMedia devuelve null si a alguna hora del tramo le falta el dato", () => {
    assert.equal(nubosidadMedia(cuatroHoras, t("02:00"), t("03:30")), null, "hora sin dato");
    assert.equal(nubosidadMedia(cuatroHoras, Date.parse("2026-11-28T23:00:00Z"), t("01:00")), null, "antes del pronóstico");
    assert.equal(nubosidadMedia(cuatroHoras, t("03:00"), t("06:00")), null, "después del pronóstico");
  });

  it("nubosidadMedia devuelve null sin pronóstico, con un pronóstico roto o con un tramo vacío", () => {
    assert.equal(nubosidadMedia(null, t("00:00"), t("01:00")), null);
    assert.equal(nubosidadMedia(undefined, t("00:00"), t("01:00")), null);
    assert.equal(nubosidadMedia({ desde: "cualquier cosa", porHora: [0, 0] }, t("00:00"), t("01:00")), null);
    assert.equal(nubosidadMedia({ desde: cuatroHoras.desde }, t("00:00"), t("01:00")), null);
    assert.equal(nubosidadMedia(cuatroHoras, t("01:00"), t("01:00")), null);
    assert.equal(nubosidadMedia(cuatroHoras, t("02:00"), t("01:00")), null);
  });

  it("estadoDelCielo cambia de palabra justo después de cada umbral", () => {
    assert.equal(estadoDelCielo(0), "despejado");
    assert.equal(estadoDelCielo(DESPEJADO_HASTA), "despejado");
    assert.equal(estadoDelCielo(DESPEJADO_HASTA + 1), "algo-nublado");
    assert.equal(estadoDelCielo(ALGO_NUBLADO_HASTA), "algo-nublado");
    assert.equal(estadoDelCielo(ALGO_NUBLADO_HASTA + 1), "nublado");
    assert.equal(estadoDelCielo(100), "nublado");
  });

  it("puntaje descuenta la nubosidad de los minutos oscuros; sin pronóstico los deja como están", () => {
    assert.equal(puntaje(240, 50), 120);
    assert.equal(puntaje(240, 0), 240);
    assert.equal(puntaje(240, 100), 0);
    assert.equal(puntaje(240, null), 240);
  });
});

describe("una noche con pronóstico", () => {
  // 29/11: franja oscura de 21:20 a 00:56, hasta que sale la Luna.
  const FRANJA = ["2026-11-29T21:00:00-03:00", "2026-11-30T01:00:00-03:00"];
  const dosDias = (nubes) => pronostico("2026-11-29T00:00:00Z", 72, nubes);

  it("mira las nubes de la franja oscura, no las del resto de la noche", () => {
    const n = nocheDeCielo(PURMAMARCA, "2026-11-29", dosDias((ms) => (entre(ms, ...FRANJA) ? 10 : 90)));
    assert.equal(n.minutosOscuros, 216);
    assert.equal(n.nubes, 10);
    assert.equal(n.puntaje, 216 * 0.9);
    assert.deepEqual(ventanaDeNubes(n), n.franja);
  });

  it("redondea la nubosidad a un entero y usa ese mismo número en el puntaje", () => {
    // 40 minutos (21:20 a 22:00) con 0 % y 176 con 50 %: 40,74 %.
    const n = nocheDeCielo(PURMAMARCA, "2026-11-29", dosDias((ms) => (entre(ms, "2026-11-29T21:00:00-03:00", "2026-11-29T22:00:00-03:00") ? 0 : 50)));
    assert.equal(n.nubes, 41);
    assert.equal(n.puntaje, puntaje(216, 41));
  });

  it("si la Luna no deja franja (22/11), mira las nubes de toda la noche cerrada", () => {
    const cerrada = ["2026-11-22T21:00:00-03:00", "2026-11-23T06:00:00-03:00"];
    const n = nocheDeCielo(PURMAMARCA, "2026-11-22", pronostico("2026-11-22T00:00:00Z", 72, (ms) => (entre(ms, ...cerrada) ? 70 : 0)));
    assert.equal(n.franja, null);
    assert.equal(n.nubes, 70);
    assert.equal(n.puntaje, 0);
    assert.deepEqual(ventanaDeNubes(n), { desde: n.nocheCerrada, hasta: n.alba });
  });

  it("si el pronóstico no cubre toda la franja, la noche queda sin nubes y con el puntaje de antes", () => {
    const hastaMedianoche = pronostico("2026-11-29T00:00:00Z", 27, () => 90);
    const n = nocheDeCielo(PURMAMARCA, "2026-11-29", hastaMedianoche);
    assert.equal(n.nubes, null);
    assert.equal(n.puntaje, 216);
  });

  it("sin pronóstico da lo mismo que antes de conocer las nubes", () => {
    const n = nocheDeCielo(PURMAMARCA, "2026-11-29");
    assert.equal(n.nubes, null);
    assert.equal(n.puntaje, n.minutosOscuros);
  });
});

describe("la mejor noche con nubes", () => {
  // Del 24 al 30/11 la Luna mengua: la noche más oscura es la del 30 (251 min) y le sigue la del 29 (216).
  const SEMANA = fechasDesde("2026-11-24", 7);
  const NOCHE_DEL_30 = ["2026-11-30T18:00:00-03:00", "2026-12-01T08:00:00-03:00"];
  const semana = (nubes, horas = 9 * 24) => pronostico("2026-11-24T00:00:00Z", horas, nubes);

  it("si la noche más oscura viene nublada, gana la anterior, despejada", () => {
    const { mejor, masOscura } = mejorNoche(PURMAMARCA, SEMANA, semana((ms) => (entre(ms, ...NOCHE_DEL_30) ? 80 : 0)));
    assert.equal(mejor.fecha, "2026-11-29");
    assert.equal(mejor.nubes, 0);
    assert.equal(masOscura.fecha, "2026-11-30");
    assert.equal(masOscura.nubes, 80);
  });

  it("cuenta el producto, no solo las nubes: con pocas nubes sigue ganando la noche más larga", () => {
    // 251 min × 90 % = 225,9, más que los 216 despejados del 29.
    const { mejor } = mejorNoche(PURMAMARCA, SEMANA, semana((ms) => (entre(ms, ...NOCHE_DEL_30) ? 10 : 0)));
    assert.equal(mejor.fecha, "2026-11-30");
    assert.equal(mejor.puntaje, 251 * 0.9);
  });

  it("una noche fuera del alcance del pronóstico compite como antes y queda sin nubes", () => {
    // El pronóstico se corta el 30 a las 18:00: la noche del 30 no tiene dato.
    const hastaEl30 = semana(() => 0, 6 * 24 + 21);
    const { noches, mejor } = mejorNoche(PURMAMARCA, SEMANA, hastaEl30);
    assert.equal(mejor.fecha, "2026-11-30");
    assert.equal(mejor.nubes, null);
    assert.equal(noches.find((n) => n.fecha === "2026-11-29").nubes, 0);
  });

  it("con todo cubierto igual elige una noche: la de Luna más fina", () => {
    const { mejor } = mejorNoche(PURMAMARCA, SEMANA, semana(() => 100));
    assert.equal(mejor.puntaje, 0);
    assert.equal(mejor.fecha, "2026-11-30");
  });

  it("sin pronóstico, la mejor es la más oscura, como antes", () => {
    const { mejor, masOscura } = mejorNoche(PURMAMARCA, SEMANA);
    assert.equal(mejor.fecha, "2026-11-30");
    assert.equal(masOscura, mejor);
  });
});

describe("el recordatorio empieza con el cielo de esa noche", () => {
  it("con franja oscura, cuando empieza la franja", () => {
    const menguante = nocheDeCielo(PURMAMARCA, "2026-11-29");
    assert.equal(inicioDelCielo(menguante), menguante.nocheCerrada);
    // Con Luna creciente (14/12) el cielo oscuro empieza cuando se pone la Luna, no al cerrarse la noche.
    const creciente = nocheDeCielo(PURMAMARCA, "2026-12-14");
    assert.equal(inicioDelCielo(creciente), creciente.franja.desde);
    assert.notEqual(inicioDelCielo(creciente), creciente.nocheCerrada);
  });

  it("si la Luna no deja franja, al cerrarse la noche; si no oscurece, null", () => {
    const llena = nocheDeCielo(PURMAMARCA, "2026-11-22");
    assert.equal(inicioDelCielo(llena), "2026-11-22T21:14:00-03:00");
    assert.equal(inicioDelCielo(nocheDeCielo({ latitude: -54.8, longitude: -68.3 }, "2026-12-21")), null);
  });

  it("faseDeLaLuna da el octavo del ciclo: llena el 24/11, menguante el 30, nueva el 8/12, creciente el 16", () => {
    assert.equal(faseDeLaLuna("2026-11-24"), 4);
    assert.equal(faseDeLaLuna("2026-11-30"), 6);
    assert.equal(faseDeLaLuna("2026-12-08"), 0);
    assert.equal(faseDeLaLuna("2026-12-16"), 2);
  });

  it("faseDeLaLuna cierra el ciclo: la víspera de la Luna nueva (7/12) ya es nueva, no un noveno octavo", () => {
    assert.equal(faseDeLaLuna("2026-12-07"), 0);
  });
});
