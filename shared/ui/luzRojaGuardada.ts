// Luz roja: tiñe toda la app de rojo para cuidar la vista acostumbrada a la oscuridad.
// El estado vive en <html data-luz="roja"> (lo pinta app/globals.css) y se recuerda en este navegador.
// Sin "use client": el layout (servidor) necesita el script. El control está en LuzRoja.tsx.
export const CLAVE_LUZ_ROJA = "andino:luz-roja";

/** Para el <head>: aplica la luz roja guardada antes del primer pintado, sin destello claro al cargar. */
export const SCRIPT_LUZ_ROJA = `try{if(localStorage.getItem("${CLAVE_LUZ_ROJA}")==="1")document.documentElement.dataset.luz="roja"}catch(e){}`;
