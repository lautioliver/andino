// Tests de «Apuntá» (orientación del teléfono → hacia dónde mira la cámara): `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { camara } from "./firmamento.ts";
import { alphaAbsoluto, deltaAngular, poseDeLaCamara, suavizarPose, vistaDeLaCamara, vistaDePose } from "./orientacion.ts";

const cerca = (real, esperado, tol = 0.5) => assert.ok(Math.abs(deltaAngular(real, esperado)) <= tol, `${real} vs ${esperado}`);

describe("vistaDeLaCamara", () => {
  // Casos armados a mano con la convención W3C: alpha crece hacia el oeste (antihorario visto desde arriba).
  const casos = [
    ["vertical, tope al norte", [0, 90, 0], { az: 0, alt: 0 }],
    ["vertical, girado 90° a la izquierda: mira al oeste", [90, 90, 0], { az: 270, alt: 0 }],
    ["vertical, girado 90° a la derecha: mira al este", [270, 90, 0], { az: 90, alt: 0 }],
    ["vertical, tope al sur", [180, 90, 0], { az: 180, alt: 0 }],
    ["inclinado hacia atrás 45°: mira al norte y arriba", [0, 135, 0], { az: 0, alt: 45 }],
    ["inclinado hacia adelante: mira al norte y abajo", [0, 60, 0], { az: 0, alt: -30 }],
  ];
  for (const [nombre, [a, b, g], esperado] of casos) {
    it(nombre, () => {
      const v = vistaDeLaCamara(a, b, g);
      cerca(v.az, esperado.az);
      assert.ok(Math.abs(v.alt - esperado.alt) < 0.5, `alt ${v.alt}`);
    });
  }

  it("apoyado boca arriba, la cámara mira al suelo", () => {
    assert.ok(vistaDeLaCamara(37, 0, 0).alt < -89.5);
  });

  it("de costado (gamma −90) la cámara queda horizontal", () => {
    // Tope al norte y apoyado sobre el lado izquierdo: gamma = −90 con beta = 0 deja la cámara al este.
    const v = vistaDeLaCamara(0, 0, -90);
    cerca(v.az, 90);
    assert.ok(Math.abs(v.alt) < 0.5);
  });

  it("acimut siempre en 0–360 y altura en −90–90", () => {
    for (let a = 0; a < 360; a += 37) for (let b = -180; b <= 180; b += 29) for (let g = -90; g <= 90; g += 23) {
      const v = vistaDeLaCamara(a, b, g);
      assert.ok(v.az >= 0 && v.az < 360 && v.alt >= -90 && v.alt <= 90, `${a},${b},${g}`);
    }
  });
});

describe("alphaAbsoluto", () => {
  it("iOS: usa webkitCompassHeading (horario) y lo pasa a alpha (antihorario)", () => {
    assert.equal(alphaAbsoluto({ alpha: 12, webkitCompassHeading: 90 }), 270);
    assert.equal(alphaAbsoluto({ alpha: 12, webkitCompassHeading: 0 }), 0);
    // De punta a punta: con el teléfono vertical, la cámara mira al rumbo de la brújula.
    cerca(vistaDeLaCamara(alphaAbsoluto({ alpha: 0, webkitCompassHeading: 120 }), 90, 0).az, 120);
  });
  it("Android: alpha absoluto tal cual", () => {
    assert.equal(alphaAbsoluto({ alpha: 45, absolute: true }), 45);
  });
  it("sin norte no inventa nada", () => {
    assert.equal(alphaAbsoluto({ alpha: 45, absolute: false }), null);
    assert.equal(alphaAbsoluto({ alpha: null, absolute: true }), null);
    assert.equal(alphaAbsoluto({ alpha: 45, webkitCompassHeading: Number.NaN }), null);
  });
});

// Vectores en el marco de la Tierra: [este, norte, arriba].
const RAD = Math.PI / 180;
const NORTE = [0, 1, 0];
const ESTE = [1, 0, 0];
const OESTE = [-1, 0, 0];
const ARRIBA = [0, 0, 1];
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const largo = (a) => Math.hypot(...a);
const angulo = (a, b) => Math.acos(Math.max(-1, Math.min(1, punto(a, b) / (largo(a) * largo(b))))) / RAD;
const direccion = (alt, az) => [Math.cos(alt * RAD) * Math.sin(az * RAD), Math.cos(alt * RAD) * Math.cos(az * RAD), Math.sin(alt * RAD)];
const vectorCerca = (real, esperado, tol = 1e-9) => assert.ok(angulo(real, esperado) <= tol || largo(real.map((v, i) => v - esperado[i])) <= tol, `${real} vs ${esperado}`);
/** `v` girado `grados` alrededor de `eje` (unitario), con la regla de la mano derecha (Rodrigues). */
const girar = (v, eje, grados) => {
  const [c, s] = [Math.cos(grados * RAD), Math.sin(grados * RAD)];
  const k = punto(eje, v) * (1 - c);
  const cruz = [eje[1] * v[2] - eje[2] * v[1], eje[2] * v[0] - eje[0] * v[2], eje[0] * v[1] - eje[1] * v[0]];
  return v.map((x, i) => x * c + cruz[i] * s + eje[i] * k);
};
/** La pose de una cámara que mira a (alt, az) con el tope volcado `giro` grados hacia la izquierda de quien la sostiene. */
const poseCon = (alt, az, giro) => {
  const frente = direccion(alt, az);
  // Quien sostiene el teléfono mira a lo largo de `frente`: volcar el tope a su izquierda es girar al revés de la mano derecha.
  return { frente, arriba: girar(direccion(alt + 90, az), frente, -giro) };
};

describe("poseDeLaCamara", () => {
  it("parado, tope al norte: mira al norte y el arriba de la imagen es el cenit", () => {
    const p = poseDeLaCamara(0, 90, 0);
    vectorCerca(p.frente, NORTE);
    vectorCerca(p.arriba, ARRIBA);
  });

  // Armados a mano: acostado, con la cámara al norte, los ejes del teléfono son x = cenit, y = oeste, z = sur
  // (tope a la izquierda) o x = suelo, y = este, z = sur (tope a la derecha).
  it("acostado con el tope a la izquierda (alpha 90, gamma −90): el arriba de la imagen apunta al oeste", () => {
    const p = poseDeLaCamara(90, 0, -90);
    vectorCerca(p.frente, NORTE);
    vectorCerca(p.arriba, OESTE);
  });

  it("acostado con el tope a la derecha (alpha 270, gamma 90): el arriba de la imagen apunta al este", () => {
    const p = poseDeLaCamara(270, 0, 90);
    vectorCerca(p.frente, NORTE);
    vectorCerca(p.arriba, ESTE);
  });

  it("si la pantalla rotó con el teléfono (90 o 270), el arriba de la imagen vuelve a ser el cenit", () => {
    vectorCerca(poseDeLaCamara(90, 0, -90, 90).arriba, ARRIBA);
    vectorCerca(poseDeLaCamara(270, 0, 90, 270).arriba, ARRIBA);
    // window.orientation informa −90 donde screen.orientation.angle informa 270.
    vectorCerca(poseDeLaCamara(270, 0, 90, -90).arriba, ARRIBA);
  });

  it("rotar la pantalla no cambia hacia dónde mira la cámara", () => {
    for (const pantalla of [90, 180, 270]) vectorCerca(poseDeLaCamara(33, 71, -20, pantalla).frente, poseDeLaCamara(33, 71, -20).frente);
  });

  it("frente y arriba son unitarios y perpendiculares, en cualquier posición", () => {
    for (let a = 0; a < 360; a += 37) for (let b = -180; b <= 180; b += 29) for (let g = -90; g <= 90; g += 23) for (const pantalla of [0, 90, 180, 270]) {
      const p = poseDeLaCamara(a, b, g, pantalla);
      assert.ok(Math.abs(largo(p.frente) - 1) < 1e-9 && Math.abs(largo(p.arriba) - 1) < 1e-9 && Math.abs(punto(p.frente, p.arriba)) < 1e-9, `${a},${b},${g},${pantalla}`);
    }
  });
});

describe("vistaDePose (inclinación lateral)", () => {
  const giroCerca = (real, esperado) => assert.ok(Math.abs(deltaAngular(real, esperado)) < 1e-6, `giro ${real} vs ${esperado}`);

  it("derecho: sin inclinación", () => {
    assert.deepEqual(vistaDePose({ frente: NORTE, arriba: ARRIBA }), { az: 0, alt: 0, giro: 0 });
  });

  it("tope volcado a la izquierda: giro positivo; a la derecha: negativo", () => {
    // Mirando al norte, la izquierda es el oeste.
    giroCerca(vistaDePose({ frente: NORTE, arriba: [-Math.sin(20 * RAD), 0, Math.cos(20 * RAD)] }).giro, 20);
    giroCerca(vistaDePose({ frente: NORTE, arriba: [Math.sin(20 * RAD), 0, Math.cos(20 * RAD)] }).giro, -20);
    // Mirando al este, la izquierda es el norte.
    giroCerca(vistaDePose({ frente: ESTE, arriba: [0, Math.sin(30 * RAD), Math.cos(30 * RAD)] }).giro, 30);
  });

  it("devuelve el rumbo, la altura y el giro con que se armó la pose", () => {
    for (const alt of [-60, -10, 0, 35, 80]) for (const az of [0, 77, 180, 291]) for (const giro of [-170, -90, -15, 0, 40, 90, 179]) {
      const v = vistaDePose(poseCon(alt, az, giro));
      cerca(v.az, az, 1e-6);
      assert.ok(Math.abs(v.alt - alt) < 1e-6, `alt ${v.alt} vs ${alt}`);
      giroCerca(v.giro, giro);
    }
  });

  it("de punta a punta con los ángulos del teléfono: acostado da ±90 y, con la pantalla rotada, 0", () => {
    giroCerca(vistaDeLaCamara(0, 90, 0).giro, 0);
    giroCerca(vistaDeLaCamara(0, 135, 0).giro, 0);
    giroCerca(vistaDeLaCamara(90, 0, -90).giro, 90);
    giroCerca(vistaDeLaCamara(270, 0, 90).giro, -90);
    giroCerca(vistaDeLaCamara(90, 0, -90, 90).giro, 0);
    giroCerca(vistaDeLaCamara(270, 0, 90, 270).giro, 0);
  });

  it("mirando justo al cenit no hay rumbo: toma el norte y el giro lleva toda la vuelta", () => {
    // Boca abajo sobre la cabeza con el tope al sur: es el límite de mirar al norte y seguir subiendo.
    assert.deepEqual(vistaDePose({ frente: ARRIBA, arriba: [0, -1, 0] }), { az: 0, alt: 90, giro: 0 });
    giroCerca(vistaDePose({ frente: ARRIBA, arriba: OESTE }).giro, 90);
  });

  it("la cámara del dibujo (firmamento) reconstruye la misma pose", () => {
    for (const alt of [-40, 0, 25, 70]) for (const az of [10, 135, 260]) for (const giro of [-120, -30, 0, 15, 90]) {
      const pose = poseCon(alt, az, giro);
      const c = camara({ ...vistaDePose(pose), fov: 60 }, 400, 800);
      vectorCerca(c.frente, pose.frente, 1e-6);
      vectorCerca(c.arriba, pose.arriba, 1e-6);
    }
  });
});

describe("suavizarPose", () => {
  it("la primera lectura pasa sin filtrar", () => {
    const p = poseCon(6, 5, 12);
    assert.equal(suavizarPose(null, p), p);
  });

  it("cruza el norte por el camino corto", () => {
    cerca(vistaDePose(suavizarPose(poseCon(10, 350, 0), poseCon(10, 10, 0), 0.5)).az, 0);
  });

  it("acerca la altura y la inclinación sin llegar de golpe", () => {
    const v = vistaDePose(suavizarPose(poseCon(0, 0, 0), poseCon(40, 0, 40), 0.25));
    assert.ok(v.alt > 7 && v.alt < 13, `alt ${v.alt}`);
    assert.ok(v.giro > 7 && v.giro < 13, `giro ${v.giro}`);
  });

  it("con k = 1 entrega la lectura nueva", () => {
    const nueva = poseCon(33, 120, -25);
    const p = suavizarPose(poseCon(0, 0, 0), nueva, 1);
    vectorCerca(p.frente, nueva.frente, 1e-9);
    vectorCerca(p.arriba, nueva.arriba, 1e-9);
  });

  it("el resultado sigue siendo una pose: unitarios y perpendiculares", () => {
    const p = suavizarPose(poseCon(20, 40, 10), poseCon(65, 130, -70), 0.4);
    assert.ok(Math.abs(largo(p.frente) - 1) < 1e-9 && Math.abs(largo(p.arriba) - 1) < 1e-9 && Math.abs(punto(p.frente, p.arriba)) < 1e-9);
  });

  it("cerca del cenit el dibujo no gira aunque el rumbo salte 180°", () => {
    // El teléfono se mueve 0,2° pasando por el cenit: el rumbo salta de 10° a 190° y el giro lo compensa.
    const antes = { frente: direccion(89.9, 10), arriba: girar([0, -1, 0], ARRIBA, -10) };
    const despues = { frente: direccion(89.9, 190), arriba: girar([0, -1, 0], ARRIBA, -10) };
    const p = suavizarPose(antes, despues, 0.5);
    assert.ok(angulo(p.arriba, antes.arriba) < 0.5, `el arriba se movió ${angulo(p.arriba, antes.arriba)}°`);
  });

  it("dos lecturas opuestas no tienen camino corto: se queda con la nueva", () => {
    const nueva = { frente: [0, -1, 0], arriba: ARRIBA };
    assert.equal(suavizarPose({ frente: NORTE, arriba: ARRIBA }, nueva, 0.5), nueva);
  });
});
