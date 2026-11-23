// Tests del cielo inmersivo: `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { campoVisible } from "./camaraTrasera.ts";
import {
  aHorizonte,
  camara,
  desplazarISO,
  direccion,
  enCamara,
  matrizHorizonte,
  oscuridad,
  POLOS_GALACTICOS,
  proyectar,
  recortarPoligono,
  tiraLocal,
  trazarRegion,
} from "./firmamento.ts";
import { computeSky } from "./motor.ts";
import { POSTAL } from "./postal.ts";

const PURMAMARCA = { latitude: -23.744, longitude: -65.499 };
const DEMO = "2026-11-22T22:00:00-03:00";
const deltaAz = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

describe("aHorizonte (catálogo J2000 → horizonte)", () => {
  const m = matrizHorizonte(PURMAMARCA, DEMO);
  const motor = Object.fromEntries(computeSky(PURMAMARCA, DEMO).map((o) => [o.id, o]));

  // El motor ya está verificado contra JPL Horizons y un cálculo independiente.
  // Diferencia esperada < 0,05°: aberración anual (≤ 0,006°) y redondeo.
  it("Sirio coincide con el motor", () => {
    const s = aHorizonte(m, 101.287155, -16.716116);
    assert.ok(Math.abs(s.alt - motor.sirio.altitudeDeg) < 0.05, JSON.stringify(s));
    assert.ok(deltaAz(s.az, motor.sirio.azimuthDeg) < 0.05, JSON.stringify(s));
  });

  it("Acrux coincide con el motor (bajo el horizonte, sin refracción)", () => {
    const a = aHorizonte(m, 186.649665, -63.099093);
    assert.ok(Math.abs(a.alt - motor.acrux.altitudeDeg) < 0.05, JSON.stringify(a));
    assert.ok(deltaAz(a.az, motor.acrux.azimuthDeg) < 0.05, JSON.stringify(a));
  });

  it("el polo sur celeste queda al sur, a la altura de la latitud", () => {
    const p = aHorizonte(m, 0, -90);
    assert.ok(Math.abs(p.alt - 23.744) < 0.5, JSON.stringify(p));
    assert.ok(deltaAz(p.az, 180) < 0.5, JSON.stringify(p));
  });
});

describe("proyección a pantalla", () => {
  const c = camara({ az: 180, alt: 20, fov: 90 }, 400, 600);

  it("el centro de la vista cae en el centro de la pantalla", () => {
    const p = proyectar(c, 20, 180);
    assert.ok(Math.abs(p.x - 200) < 1e-6 && Math.abs(p.y - 300) < 1e-6);
  });

  it("mirando al sur, el este queda a la izquierda y el oeste a la derecha", () => {
    assert.ok(proyectar(c, 20, 150).x < 200);
    assert.ok(proyectar(c, 20, 210).x > 200);
  });

  it("más alto en el cielo es más arriba en la pantalla", () => {
    assert.ok(proyectar(c, 40, 180).y < proyectar(c, 0, 180).y);
  });

  it("el borde del campo visual cae en el borde de la pantalla", () => {
    const c0 = camara({ az: 0, alt: 0, fov: 90 }, 400, 600);
    assert.ok(Math.abs(proyectar(c0, 0, 45).x - 400) < 1e-6);
  });

  it("lo que está a la espalda no se proyecta", () => {
    assert.equal(proyectar(c, 20, 0), null);
  });

  it("recorta polígonos que cruzan detrás del observador", () => {
    const pts = [
      [0, 0, 1],
      [1, 0, -1],
      [0, 1, 1],
    ];
    const r = recortarPoligono(pts, -0.2);
    assert.ok(r.every((p) => p[2] >= -0.2 - 1e-9));
    assert.equal(r.length, 4);
    assert.ok(enCamara(c, 20, 180)[2] > 0.999);
  });
});

describe("cámara ladeada (giro)", () => {
  const vista = { az: 180, alt: 20, fov: 90 };
  const derecha = camara(vista, 400, 600);
  // Tope del teléfono volcado 20° a la izquierda: en la pantalla, el mundo se ve girado 20° a la derecha.
  const ladeada = camara({ ...vista, giro: 20 }, 400, 600);

  it("sin giro, o con una vuelta entera, la cámara es la de siempre", () => {
    assert.deepEqual(camara({ ...vista, giro: 0 }, 400, 600), derecha);
    // El giro va en grados: 360 es una vuelta completa.
    const vuelta = proyectar(camara({ ...vista, giro: 360 }, 400, 600), 40, 150);
    const sinGiro = proyectar(derecha, 40, 150);
    assert.ok(Math.abs(vuelta.x - sinGiro.x) < 1e-6 && Math.abs(vuelta.y - sinGiro.y) < 1e-6, JSON.stringify(vuelta));
  });

  it("el centro de la vista no se mueve", () => {
    const p = proyectar(ladeada, 20, 180);
    assert.ok(Math.abs(p.x - 200) < 1e-6 && Math.abs(p.y - 300) < 1e-6);
  });

  it("lo que está más alto en el cielo se corre hacia la derecha de la pantalla", () => {
    const p = proyectar(ladeada, 40, 180);
    assert.ok(p.x > 200 && p.y < 300, JSON.stringify(p));
  });

  it("el horizonte baja hacia la derecha", () => {
    // Mirando al sur, el oeste (acimut 210) queda a la derecha.
    assert.ok(proyectar(ladeada, 0, 210).y > proyectar(ladeada, 0, 150).y);
    assert.ok(Math.abs(proyectar(derecha, 0, 210).y - proyectar(derecha, 0, 150).y) < 1e-6);
  });

  it("es un giro alrededor del centro: la distancia al centro no cambia y el ángulo es el pedido", () => {
    const a = proyectar(derecha, 40, 180);
    const b = proyectar(ladeada, 40, 180);
    assert.ok(Math.abs(Math.hypot(a.x - 200, a.y - 300) - Math.hypot(b.x - 200, b.y - 300)) < 1e-6);
    // «a» queda justo arriba del centro; «b», 20° hacia la derecha.
    const angulo = (Math.atan2(b.x - 200, 300 - b.y) * 180) / Math.PI;
    assert.ok(Math.abs(angulo - 20) < 1e-6, `${angulo}`);
  });

  it("acostado (giro 90), lo que estaba arriba queda a la derecha", () => {
    const p = proyectar(camara({ ...vista, giro: 90 }, 400, 600), 40, 180);
    assert.ok(p.x > 200 && Math.abs(p.y - 300) < 1e-6, JSON.stringify(p));
  });
});

describe("tiempo y luz", () => {
  it("desplaza minutos manteniendo la zona de Argentina", () => {
    assert.equal(desplazarISO("2026-11-22T22:00:00-03:00", 150), "2026-11-23T00:30:00-03:00");
    assert.equal(desplazarISO("2026-11-23T01:00:00Z", -60), "2026-11-22T21:00:00-03:00");
  });

  it("oscuridad: de día 0, de noche cerrada 1", () => {
    assert.equal(oscuridad(10), 0);
    assert.equal(oscuridad(-20), 1);
    assert.ok(oscuridad(-8) > 0 && oscuridad(-8) < 1);
  });
});

describe("catálogo", () => {
  const cat = JSON.parse(readFileSync(new URL("../../data/cielo/catalogo.json", import.meta.url), "utf8"));

  it("tiene estrellas, 88 constelaciones (Serpiente en dos) y Vía Láctea", () => {
    assert.ok(cat.estrellas.length > 1500);
    assert.equal(cat.constelaciones.length, 89);
    assert.ok(cat.viaLactea.length >= 3);
    assert.match(cat.fuente, /d3-celestial/);
  });

  it("Sirio es la estrella más brillante y está en su lugar", () => {
    const [ar, dec, mag] = cat.estrellas[0];
    assert.ok(Math.abs(ar - 101.29) < 0.05 && Math.abs(dec + 16.72) < 0.05 && mag < -1.4);
  });

  it("la Cruz del Sur se llama así", () => {
    assert.equal(cat.constelaciones.find((c) => c.id === "Cru").nombre, "Cruz del Sur");
  });
});

// --- Vía Láctea: lo que se rellena en la pantalla contra la región real, medida en la esfera ---

const RAD = Math.PI / 180;
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vertice = (tira, i) => [tira[3 * i], tira[3 * i + 1], tira[3 * i + 2]];

/** ¿Se cruzan los arcos de círculo máximo a→b y c→d? (los dos de menos de 180°). */
function seCruzan(a, b, c, d) {
  const planoAB = cruz(a, b);
  const c1 = punto(planoAB, c);
  const d1 = punto(planoAB, d);
  if (c1 > 0 === d1 > 0) return false;
  const planoCD = cruz(c, d);
  const a2 = punto(planoCD, a);
  const b2 = punto(planoCD, b);
  if (a2 > 0 === b2 > 0) return false;
  // Cada arco corta el plano del otro en un punto: se cruzan si es el mismo, y no su antípoda.
  const enCD = [0, 1, 2].map((i) => c[i] * Math.abs(d1) + d[i] * Math.abs(c1));
  const enAB = [0, 1, 2].map((i) => a[i] * Math.abs(b2) + b[i] * Math.abs(a2));
  return punto(enCD, enAB) > 0;
}

/** Cuántas veces cruza los bordes de la región el arco de círculo máximo a→b. */
function crucesDelArco(anillos, a, b) {
  const plano = cruz(a, b);
  const lado = (tira, i) => plano[0] * tira[3 * i] + plano[1] * tira[3 * i + 1] + plano[2] * tira[3 * i + 2] > 0;
  let cruces = 0;
  for (const tira of anillos) {
    const n = tira.length / 3;
    let antes = lado(tira, n - 1);
    for (let i = 0; i < n; i++) {
      const ahora = lado(tira, i);
      // Solo un borde que pasa de un lado al otro del plano del arco puede cruzarlo.
      if (ahora !== antes && seCruzan(a, b, vertice(tira, (i + n - 1) % n), vertice(tira, i))) cruces++;
      antes = ahora;
    }
  }
  return cruces;
}

/**
 * La verdad, sin proyección: `p` está en la región si el arco de círculo máximo hasta un punto de afuera
 * (el polo galáctico más cercano) cruza sus bordes una cantidad impar de veces.
 */
function dentroReal(anillos, p, polos) {
  const polo = punto(p, vertice(polos, 0)) >= 0 ? vertice(polos, 0) : vertice(polos, 1);
  return crucesDelArco(anillos, p, polo) % 2 === 1;
}

/** A menos de `grados` de un vértice del borde no se compara: ahí decide el redondeo (los bordes miden menos de 0,6°). */
function pegadoAlBorde(anillos, p, grados = 0.5) {
  const minimo = Math.cos(grados * RAD);
  for (const tira of anillos) {
    for (let i = 0; i < tira.length; i += 3) if (p[0] * tira[i] + p[1] * tira[i + 1] + p[2] * tira[i + 2] > minimo) return true;
  }
  return false;
}

/** Un trazado que anota lo que le piden, en vez de un lienzo: cada subtrazado, como x, y seguidos. */
function registrador() {
  const subtrazados = [];
  return {
    subtrazados,
    moveTo: (x, y) => subtrazados.push([x, y]),
    lineTo: (x, y) => subtrazados.at(-1).push(x, y),
    closePath: () => {},
    rect: (x, y, ancho, alto) => subtrazados.push([x, y, x + ancho, y, x + ancho, y + alto, x, y + alto]),
  };
}

/** Lo que pintaría `fill("evenodd")` en el punto (x, y) de la pantalla. */
function rellenoEn(subtrazados, x, y) {
  let cruces = 0;
  for (const s of subtrazados) {
    for (let i = 0, j = s.length - 2; i < s.length; j = i, i += 2) {
      if (s[i + 1] > y !== s[j + 1] > y && x < s[i] + ((y - s[i + 1]) * (s[j] - s[i])) / (s[j + 1] - s[i + 1])) cruces++;
    }
  }
  return cruces % 2 === 1;
}

/** La dirección del cielo (vector local) que cae en el punto (x, y) de la pantalla: la estereográfica al revés. */
function direccionEnPantalla(c, x, y) {
  const X = (x - c.ancho / 2) / c.escala;
  const Y = (c.alto / 2 - y) / c.escala;
  const z = (4 - X * X - Y * Y) / (4 + X * X + Y * Y);
  const k = (1 + z) / 2;
  return [0, 1, 2].map((i) => X * k * c.derecha[i] + Y * k * c.arriba[i] + z * c.frente[i]);
}

/** Lo que `dibujarCielo` rellena de un nivel: el trazado, o nada si la función dice que no se rellene. */
function trazar(c, anillos, afuera) {
  const trazo = registrador();
  return trazarRegion(trazo, c, anillos, afuera) ? trazo.subtrazados : [];
}

/**
 * Compara, en una grilla de puntos de la pantalla, lo que se rellena con la región real. Devuelve cuántos
 * puntos comparó de cada lado y cuáles no coinciden.
 */
function comparar(c, anillos, polos, rotulo = "", columnas = 6, filas = 8) {
  const subtrazados = trazar(c, anillos, polos);
  const r = { dentro: 0, fuera: 0, distintos: [] };
  for (let i = 0; i < columnas; i++) {
    for (let j = 0; j < filas; j++) {
      const x = ((i + 0.5) / columnas) * c.ancho;
      const y = ((j + 0.5) / filas) * c.alto;
      const p = direccionEnPantalla(c, x, y);
      if (pegadoAlBorde(anillos, p)) continue;
      const real = dentroReal(anillos, p, polos);
      if (real) r.dentro++;
      else r.fuera++;
      if (rellenoEn(subtrazados, x, y) !== real) r.distintos.push(`${rotulo} (${Math.round(x)}, ${Math.round(y)}): ${real ? "falta relleno" : "relleno de más"}`);
    }
  }
  return r;
}

describe("Vía Láctea: lo que se rellena en pantalla es la región real", () => {
  const cat = JSON.parse(readFileSync(new URL("../../data/cielo/catalogo.json", import.meta.url), "utf8"));
  const TILCARA = { latitude: -23.5768, longitude: -65.3934 };
  const m = matrizHorizonte(TILCARA, "2026-11-23T23:30:00-03:00");
  const niveles = cat.viaLactea.map((n) => ({ nivel: n.nivel, anillos: n.poligonos.map((p) => tiraLocal(m, p)) }));
  const polos = tiraLocal(m, POLOS_GALACTICOS);
  const [norte, sur] = [vertice(polos, 0), vertice(polos, 1)];
  const centroGalactico = vertice(tiraLocal(m, [[266.4, -29.0]]), 0);

  it("la tira local de un punto es su dirección en el horizonte", () => {
    const { alt, az } = aHorizonte(m, 101.287155, -16.716116);
    assert.deepEqual([...tiraLocal(m, [[101.287155, -16.716116]])], direccion(alt, az));
  });

  it("la vuelta de pantalla a cielo deshace la proyección", () => {
    const c = camara({ az: 200, alt: 35, fov: 80, giro: 25 }, 390, 844);
    const q = proyectar(c, 50, 170);
    const p = direccionEnPantalla(c, q.x, q.y);
    direccion(50, 170).forEach((v, i) => assert.ok(Math.abs(v - p[i]) < 1e-12, `${p}`));
  });

  it("los polos galácticos, la referencia de «afuera», están lejos de todo borde y del mismo lado", () => {
    // Un punto del ecuador galáctico cada 30° de longitud, desde el centro.
    const haciaElCentro = centroGalactico.map((v, i) => v - punto(centroGalactico, norte) * norte[i]);
    const perpendicular = cruz(norte, haciaElCentro);
    for (const { nivel, anillos } of niveles) {
      for (const polo of [norte, sur]) assert.equal(pegadoAlBorde(anillos, polo, 60), false, `nivel ${nivel}`);
      for (let l = 0; l < 360; l += 30) {
        const ecuador = haciaElCentro.map((v, i) => v * Math.cos(l * RAD) + perpendicular[i] * Math.sin(l * RAD));
        // De polo a polo, un meridiano galáctico entra y sale de la región: cruza sus bordes un número par de veces.
        assert.equal((crucesDelArco(anillos, norte, ecuador) + crucesDelArco(anillos, ecuador, sur)) % 2, 0, `nivel ${nivel}, longitud ${l}`);
      }
    }
  });

  it("control astronómico: el centro galáctico queda dentro del nivel más extendido", () => {
    assert.equal(dentroReal(niveles.find((n) => n.nivel === 1).anillos, centroGalactico, polos), true);
  });

  // Los formatos en que se dibuja: la pantalla en el teléfono y en la computadora, «Ver con la cámara»
  // (teléfono vertical y ladeado, con el campo de su cámara) y el cielo de la postal.
  const FORMATOS = {
    "teléfono (375 × 420, campo de 80°)": { ancho: 375, alto: 420, fov: 80 },
    "computadora (1280 × 640, campo de 100°)": { ancho: 1280, alto: 640, fov: 100 },
    "cámara vertical ladeada 25°": { ancho: 390, alto: 844, fov: campoVisible({ ancho: 1080, alto: 1920 }, { ancho: 390, alto: 844 }), giro: 25 },
    "cámara con campo de 55°, casi acostada": { ancho: 390, alto: 844, fov: 55, giro: -70 },
    "postal": { ancho: POSTAL.cielo.ancho / POSTAL.escalaCielo, alto: POSTAL.cielo.alto / POSTAL.escalaCielo, fov: POSTAL.campoCielo },
  };

  for (const [nombre, { ancho, alto, fov, giro }] of Object.entries(FORMATOS)) {
    it(`${nombre}: en todos los rumbos (cada 30°) y a 5°, 40° y 80° de altura`, () => {
      const total = { dentro: 0, fuera: 0, distintos: [] };
      for (const alt of [5, 40, 80]) {
        for (let az = 0; az < 360; az += 30) {
          const c = camara({ az, alt, fov, giro }, ancho, alto);
          for (const { nivel, anillos } of niveles) {
            const r = comparar(c, anillos, polos, `nivel ${nivel}, rumbo ${az}, altura ${alt}`);
            total.dentro += r.dentro;
            total.fuera += r.fuera;
            total.distintos.push(...r.distintos);
          }
        }
      }
      // Que la comparación no sea vacía: hay puntos de los dos lados.
      assert.ok(total.dentro > 200 && total.fuera > 2000, JSON.stringify({ dentro: total.dentro, fuera: total.fuera }));
      assert.deepEqual(total.distintos.slice(0, 8), [], `${total.distintos.length} de ${total.dentro + total.fuera} puntos no coinciden`);
    });
  }
});
