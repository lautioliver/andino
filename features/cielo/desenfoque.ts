// Desenfoque de la Vía Láctea: suaviza los bordes de los contornos del catálogo para que se vea
// como una nube y no como manchas recortadas. Lógica pura (sin DOM). Propiedad: jehp23.

/** Una pasada de promedio móvil de radio `r` sobre `n` valores separados por `paso`, con bordes extendidos. */
function caja(v: Float32Array, inicio: number, n: number, paso: number, r: number, tmp: Float32Array) {
  const ventana = 2 * r + 1;
  const en = (i: number) => v[inicio + Math.min(n - 1, Math.max(0, i)) * paso];
  let suma = 0;
  for (let i = -r; i <= r; i++) suma += en(i);
  for (let i = 0; i < n; i++) {
    tmp[i] = suma / ventana;
    suma += en(i + r + 1) - en(i - r);
  }
  for (let i = 0; i < n; i++) v[inicio + i * paso] = tmp[i];
}

/**
 * Desenfoca el alfa de una imagen RGBA (tres pasadas de caja por eje ≈ gaussiano) y pinta
 * todos los píxeles de `color`: así el borde se desvanece en vez de oscurecerse.
 */
export function desenfocarAlfa(
  datos: Uint8ClampedArray,
  ancho: number,
  alto: number,
  radio: number,
  color: readonly [number, number, number],
): Uint8ClampedArray {
  const alfa = new Float32Array(ancho * alto);
  for (let i = 0; i < alfa.length; i++) alfa[i] = datos[i * 4 + 3];
  const tmp = new Float32Array(Math.max(ancho, alto));
  for (let pasada = 0; pasada < 3; pasada++) {
    for (let y = 0; y < alto; y++) caja(alfa, y * ancho, ancho, 1, radio, tmp);
    for (let x = 0; x < ancho; x++) caja(alfa, x, alto, ancho, radio, tmp);
  }
  const salida = new Uint8ClampedArray(datos.length);
  for (let i = 0; i < alfa.length; i++) {
    salida[i * 4] = color[0];
    salida[i * 4 + 1] = color[1];
    salida[i * 4 + 2] = color[2];
    salida[i * 4 + 3] = Math.round(alfa[i]);
  }
  return salida;
}
