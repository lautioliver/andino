// Genera data/cielo/catalogo.json a partir de los datos de d3-celestial 0.7.35
// (BSD-3-Clause, © 2015 Olaf Frohn, https://github.com/ofrohn/d3-celestial).
//
// Uso: node scripts/generar-catalogo.mjs <carpeta-con-los-json-de-d3-celestial>
// Archivos: stars.6.json, constellations.json, constellations.lines.json, mw.json
// (https://cdn.jsdelivr.net/npm/d3-celestial@0.7.35/data/<archivo>).
//
// Formato compacto, coordenadas J2000 en grados (AR 0–360, Dec −90–90):
//   estrellas:      [ar, dec, magnitud, B−V]
//   constelaciones: { id, nombre, etiqueta: [ar, dec], lineas: [[[ar, dec], ...], ...] }
//   viaLactea:      [{ nivel 1–3, poligonos: [[[ar, dec], ...], ...] }]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [carpeta] = process.argv.slice(2);
if (!carpeta) throw new Error("Falta la carpeta con los JSON de d3-celestial");
const leer = (archivo) => JSON.parse(readFileSync(join(carpeta, archivo), "utf8")).features;

const MAG_MAX = 5;
const r = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const ar = (lon) => r(((lon % 360) + 360) % 360);
const punto = ([lon, lat], d = 2) => [r(((lon % 360) + 360) % 360, d), r(lat, d)];

const estrellas = leer("stars.6.json")
  .filter((f) => f.properties.mag <= MAG_MAX)
  .sort((a, b) => a.properties.mag - b.properties.mag)
  .map((f) => [ar(f.geometry.coordinates[0]), r(f.geometry.coordinates[1]), r(f.properties.mag), r(Number(f.properties.bv) || 0.6)]);

const nombres = Object.fromEntries(leer("constellations.json").map((f) => [f.id, f.properties]));
const constelaciones = leer("constellations.lines.json").map((f) => {
  const p = nombres[f.id];
  return {
    id: f.id,
    nombre: (p?.es ?? p?.name ?? f.id).replace(/\s+/gu, " "),
    etiqueta: p ? punto([p.display?.[0] ?? f.geometry.coordinates[0][0][0], p.display?.[1] ?? 0]) : punto(f.geometry.coordinates[0][0]),
    lineas: f.geometry.coordinates.map((linea) => linea.map((c) => punto(c))),
  };
});

// Vía Láctea: los tres niveles más extendidos, simplificados (1 de cada 3 vértices, 1 decimal).
const viaLactea = leer("mw.json")
  .filter((f) => ["ol1", "ol2", "ol3"].includes(f.id))
  .map((f) => ({
    nivel: Number(f.id.slice(2)),
    poligonos: f.geometry.coordinates.flatMap((poligono) =>
      poligono.map((anillo) => anillo.filter((_, i) => i % 3 === 0).map((c) => punto(c, 1))).filter((a) => a.length >= 3),
    ),
  }));

const salida = {
  fuente: "d3-celestial 0.7.35 (BSD-3-Clause, © 2015 Olaf Frohn) · https://github.com/ofrohn/d3-celestial",
  magnitudMaxima: MAG_MAX,
  estrellas,
  constelaciones,
  viaLactea,
};
const destino = new URL("../data/cielo/catalogo.json", import.meta.url);
writeFileSync(destino, JSON.stringify(salida));
console.log(`${estrellas.length} estrellas, ${constelaciones.length} constelaciones → ${destino.pathname}`);
