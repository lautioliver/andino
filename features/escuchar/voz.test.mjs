// Tests de «Escuchar»: qué voz se elige y cómo se parte el texto para leerlo. `npm test`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { elegirVoz, MAX_TRAMO, partirEnOraciones } from "./voz.ts";

const voz = (name, lang, extra = {}) => ({ name, lang, voiceURI: name, localService: true, default: false, ...extra });

// Las voces en español y en inglés de un Mac, en el orden y con los datos que da Chrome (22/11/2026):
// primero la del sistema, después por nombre. El identificador es el nombre.
const MAC_EN_CHROME = [
  voz("Mónica", "es-ES", { default: true }),
  voz("Albert", "en-US"),
  voz("Bad News", "en-US"),
  voz("Bahh", "en-US"),
  voz("Bells", "en-US"),
  voz("Boing", "en-US"),
  voz("Bubbles", "en-US"),
  voz("Buenas noticias", "en-US"),
  voz("Cellos", "en-US"),
  voz("Daniel", "en-GB"),
  voz("Eddy (español (España))", "es-ES"),
  voz("Eddy (español (México))", "es-MX"),
  voz("Eddy (inglés (Reino Unido))", "en-GB"),
  voz("Eddy (inglés (Estados Unidos))", "en-US"),
  voz("Flo (español (México))", "es-MX"),
  voz("Fred", "en-US"),
  voz("Grandma (español (México))", "es-MX"),
  voz("Karen", "en-AU"),
  voz("Paulina", "es-MX"),
  voz("Samantha", "en-US"),
  voz("Zarvox", "en-US"),
  voz("Thomas", "fr-FR"),
];

// Con los identificadores que les da el sistema de Apple (los de este Mac, 22/11/2026) y nombres que no
// están en la lista de voces de efectos, como si vinieran traducidos.
const APPLE = [
  voz("Abuela", "es-MX", { voiceURI: "com.apple.eloquence.es-MX.Grandma" }),
  voz("Malas noticias", "en-US", { voiceURI: "com.apple.speech.synthesis.voice.BadNews" }),
  voz("Paulina", "es-MX", { voiceURI: "com.apple.voice.compact.es-MX.Paulina" }),
  voz("Samantha", "en-US", { voiceURI: "com.apple.voice.super-compact.en-US.Samantha" }),
];

describe("elegir la voz", () => {
  it("en español prefiere la de Argentina, esté donde esté en la lista", () => {
    const voces = [voz("Mónica", "es-ES", { default: true }), voz("Paulina", "es-MX"), voz("Diego", "es-AR"), voz("Samantha", "en-US")];
    assert.equal(elegirVoz(voces, "es").name, "Diego");
    assert.equal(elegirVoz([...voces].reverse(), "es").name, "Diego");
  });

  it("sin Argentina, las de América (es-419, es-MX, es-US) antes que cualquier otra", () => {
    for (const lang of ["es-419", "es-MX", "es-US"]) {
      const voces = [voz("Mónica", "es-ES", { default: true }), voz("Francisca", "es-CL"), voz("Americana", lang)];
      assert.equal(elegirVoz(voces, "es").name, "Americana", lang);
    }
  });

  it("si no hay de esas, cualquier voz en español", () => {
    assert.equal(elegirVoz([voz("Samantha", "en-US"), voz("Mónica", "es-ES")], "es").name, "Mónica");
    assert.equal(elegirVoz([voz("Francisca", "es-CL"), voz("Mónica", "es-ES")], "es").name, "Francisca");
    assert.equal(elegirVoz([voz("Genérica", "es")], "es").name, "Genérica");
  });

  it("en inglés sirve cualquier región", () => {
    assert.equal(elegirVoz([voz("Mónica", "es-ES"), voz("Karen", "en-AU"), voz("Samantha", "en-US")], "en").name, "Karen");
    assert.equal(elegirVoz([voz("Genérica", "en")], "en").name, "Genérica");
  });

  it("nunca devuelve una voz de otro idioma: sin voz para ese idioma, null", () => {
    const ingles = [voz("Samantha", "en-US"), voz("Daniel", "en-GB")];
    assert.equal(elegirVoz(ingles, "es"), null);
    assert.equal(elegirVoz([voz("Mónica", "es-ES"), voz("Thomas", "fr-FR")], "en"), null);
    assert.equal(elegirVoz([], "es"), null);
    // Idiomas cuyo código empieza igual: estonio, esperanto, inglés medio.
    assert.equal(elegirVoz([voz("Mari", "et-EE"), voz("Eesti", "est"), voz("Esperanto", "eo")], "es"), null);
    assert.equal(elegirVoz([voz("Chaucer", "enm"), voz("Eesti", "et")], "en"), null);
  });

  it("entiende las etiquetas como las escribe Android: es_AR, ES-ar", () => {
    assert.equal(elegirVoz([voz("España", "es_ES"), voz("Argentina", "es_AR")], "es").name, "Argentina");
    assert.equal(elegirVoz([voz("España", "ES-es"), voz("Estados Unidos", "ES-us")], "es").name, "Estados Unidos");
    assert.equal(elegirVoz([voz("English", "en_GB")], "en").name, "English");
  });

  it("en un Mac con Chrome deja de lado las voces de efectos: Paulina y Daniel, no Eddy ni Albert", () => {
    assert.equal(elegirVoz(MAC_EN_CHROME, "es").name, "Paulina");
    assert.equal(elegirVoz(MAC_EN_CHROME, "en").name, "Daniel");
  });

  it("reconoce las voces de efectos de Apple por el identificador, aunque el nombre esté traducido", () => {
    assert.equal(elegirVoz(APPLE, "es").name, "Paulina");
    assert.equal(elegirVoz(APPLE, "en").name, "Samantha");
  });

  it("una voz normal de otra región le gana a una de efectos de la región preferida", () => {
    assert.equal(elegirVoz([voz("Eddy (español (México))", "es-MX"), voz("Mónica", "es-ES")], "es").name, "Mónica");
  });

  it("si para el idioma solo hay voces de efectos, usa una: el botón tiene que aparecer", () => {
    assert.equal(elegirVoz([voz("Albert", "en-US"), voz("Mónica", "es-ES")], "en").name, "Albert");
  });

  it("en la misma región prefiere la que está en el teléfono a la que viene por la red", () => {
    const voces = [voz("Google español de Estados Unidos", "es-US", { localService: false }), voz("Paulina", "es-MX")];
    assert.equal(elegirVoz(voces, "es").name, "Paulina");
    // Pero la región pesa más: una de Argentina por la red le gana a una de México en el teléfono.
    assert.equal(elegirVoz([voz("Paulina", "es-MX"), voz("Red", "es-AR", { localService: false })], "es").name, "Red");
  });

  it("a igualdad de lo demás, la que el sistema marca por defecto; si no, la primera", () => {
    assert.equal(elegirVoz([voz("Samantha", "en-US"), voz("Daniel", "en-GB", { default: true })], "en").name, "Daniel");
    assert.equal(elegirVoz([voz("Samantha", "en-US"), voz("Daniel", "en-GB")], "en").name, "Samantha");
  });

  it("devuelve el mismo objeto de la lista, que es el que hay que darle al navegador", () => {
    const paulina = voz("Paulina", "es-MX");
    assert.equal(elegirVoz([voz("Samantha", "en-US"), paulina], "es"), paulina);
  });

  it("no se rompe con voces a medio armar", () => {
    const rotas = [null, undefined, {}, { name: 7, lang: null }, { lang: "es-AR" }];
    assert.deepEqual(elegirVoz(rotas, "es"), { lang: "es-AR" });
    assert.equal(elegirVoz(rotas, "en"), null);
  });
});

const LUNA =
  "El único satélite natural de la Tierra, a unos 384.000 km. No tiene luz propia: refleja la del Sol, y por eso cambia de fase en un ciclo de unos 29,5 días.";
const YACANA =
  "En la Vía Láctea no solo hay figuras de estrellas: sus manchas oscuras también forman animales. Una de ellas es la Yacana, una llama que camina por el centro del cielo. Sus ojos son las dos estrellas brillantes que acompañan a la Cruz del Sur, α y β Centauri.";
const SIGNO_EN =
  "The horoscope dates were set about 2,000 years ago. Since then Earth's axis has shifted (precession), and today the Sun passes through each constellation almost a month later on average. It also crosses a thirteenth one, Ophiuchus. This is astronomy: it makes no predictions.";
const LARGA =
  "Esta noche, el mejor momento para ver sus ojos es a las 03:40, de madrugada: hacia el sudeste, a media altura, por encima de los cerros de la quebrada, cuando ya se puso la Luna; antes, el cielo todavía tiene luz y las manchas oscuras de la Vía Láctea no se distinguen.";

/** Lo que tiene que quedar al unir los tramos: el mismo texto, con los espacios reducidos a uno. */
const enLimpio = (texto) => texto.replace(/\s+/g, " ").trim();

describe("partir el texto en oraciones", () => {
  it("un tramo por oración, con su puntuación, sin cortar los números", () => {
    assert.deepEqual(partirEnOraciones(LUNA), [
      "El único satélite natural de la Tierra, a unos 384.000 km.",
      "No tiene luz propia: refleja la del Sol, y por eso cambia de fase en un ciclo de unos 29,5 días.",
    ]);
    assert.equal(partirEnOraciones(YACANA).length, 3);
    assert.equal(partirEnOraciones(SIGNO_EN).length, 4);
  });

  it("corta también en ?, ! y …, y deja las comillas y paréntesis de cierre con su oración", () => {
    assert.deepEqual(partirEnOraciones("¿Cuándo salir? ¡Esta noche! «Mirá hacia el sur.» Después verás… Y (con suerte.) Listo"), [
      "¿Cuándo salir?",
      "¡Esta noche!",
      "«Mirá hacia el sur.»",
      "Después verás…",
      "Y (con suerte.)",
      "Listo",
    ]);
    for (const cierre of ["»", "”", "’", '"', "'", ")", "]"]) {
      assert.deepEqual(partirEnOraciones(`Uno.${cierre} Dos.`), [`Uno.${cierre}`, "Dos."], cierre);
    }
  });

  it("un título sin punto es un tramo; un texto vacío o de solo signos, ninguno", () => {
    assert.deepEqual(partirEnOraciones("La llama del cielo andino"), ["La llama del cielo andino"]);
    assert.deepEqual(partirEnOraciones(""), []);
    assert.deepEqual(partirEnOraciones("  \n\t "), []);
    assert.deepEqual(partirEnOraciones("… — ¿?"), []);
  });

  it("reduce saltos de línea y espacios repetidos a un espacio", () => {
    assert.deepEqual(partirEnOraciones("  Una   llama\n que camina.\n\n  Sus ojos\tbrillan.  "), ["Una llama que camina.", "Sus ojos brillan."]);
  });

  it("no corta en una inicial ni en una abreviatura de una letra", () => {
    assert.deepEqual(partirEnOraciones("Manuscrito de Huarochirí, c. 1600. Traducción de J. M. Arguedas (1966)."), [
      "Manuscrito de Huarochirí, c. 1600.",
      "Traducción de J. M. Arguedas (1966).",
    ]);
    // Una palabra de una letra seguida de otra puntuación sí cierra la oración.
    assert.deepEqual(partirEnOraciones("¿Es de tipo A? Sí."), ["¿Es de tipo A?", "Sí."]);
    // Y un número de una cifra no es una inicial.
    assert.deepEqual(partirEnOraciones("Son 7. Se ven todas."), ["Son 7.", "Se ven todas."]);
  });

  it("un tramo sin letras ni números va pegado al siguiente, o al anterior si es el último", () => {
    assert.deepEqual(partirEnOraciones("«… es una oscuridad del cielo»."), ["«… es una oscuridad del cielo»."]);
    assert.deepEqual(partirEnOraciones("Mirá al sur. …"), ["Mirá al sur. …"]);
  });

  it("una oración más larga que el máximo se parte en sus pausas, y ningún tramo se pasa", () => {
    assert.ok(LARGA.length > MAX_TRAMO);
    const tramos = partirEnOraciones(LARGA);
    assert.deepEqual(tramos, [
      "Esta noche, el mejor momento para ver sus ojos es a las 03:40, de madrugada: hacia el sudeste, a media altura, por encima de los cerros de la quebrada,",
      "cuando ya se puso la Luna; antes, el cielo todavía tiene luz y las manchas oscuras de la Vía Láctea no se distinguen.",
    ]);
    assert.deepEqual(partirEnOraciones(LARGA, 60), [
      "Esta noche,",
      "el mejor momento para ver sus ojos es a las 03:40,",
      "de madrugada: hacia el sudeste, a media altura,",
      "por encima de los cerros de la quebrada,",
      "cuando ya se puso la Luna; antes,",
      "el cielo todavía tiene luz y las manchas oscuras de la Vía",
      "Láctea no se distinguen.",
    ]);
    // Cada pausa corta por su cuenta: por palabras, el primer tramo llegaría hasta la «j».
    for (const pausa of [",", ";", ":"]) {
      assert.deepEqual(partirEnOraciones(`a b${pausa} c d e f g h i j k`, 20), [`a b${pausa}`, "c d e f g h i j k"], pausa);
    }
  });

  it("sin pausas corta entre palabras, y sin espacios, a la fuerza, sin partir un carácter al medio", () => {
    assert.deepEqual(partirEnOraciones("uno dos tres cuatro cinco seis", 9), ["uno dos", "tres", "cuatro", "cinco", "seis"]);
    assert.deepEqual(partirEnOraciones("abcdefghij", 4), ["abcd", "efgh", "ij"]);
    // Cada luna ocupa dos unidades: cortar de a tres dejaría media luna en cada tramo.
    assert.deepEqual(partirEnOraciones("ab\u{1F319}\u{1F319}\u{1F319}", 3), ["ab", "\u{1F319}", "\u{1F319}", "\u{1F319}"]);
  });

  it("no pierde ni cambia nada: los tramos unidos son el texto, con cualquier máximo", () => {
    const textos = [LUNA, YACANA, SIGNO_EN, LARGA, "«… es una oscuridad del cielo».\n  Manuscrito de Huarochirí, c. 1600.", "a".repeat(500), "sí, ".repeat(200)];
    for (const texto of textos) {
      for (const max of [1, 7, 40, MAX_TRAMO, 10_000]) {
        const tramos = partirEnOraciones(texto, max);
        assert.equal(tramos.join(" ").replace(/ /g, ""), enLimpio(texto).replace(/ /g, ""), `max ${max}`);
        // Si ninguna palabra pasa del máximo no hubo cortes a la fuerza: tampoco cambian los espacios.
        if (enLimpio(texto).split(" ").every((palabra) => palabra.length <= max)) assert.equal(tramos.join(" "), enLimpio(texto), `max ${max}`);
        for (const tramo of tramos) {
          assert.ok(tramo.length <= max, `«${tramo}» pasa de ${max}`);
          assert.equal(tramo, tramo.trim());
          assert.notEqual(tramo, "");
        }
      }
    }
  });

  it("con el máximo por defecto, y con uno que no sirve, usa MAX_TRAMO", () => {
    const texto = "palabra ".repeat(100);
    const esperado = partirEnOraciones(texto, MAX_TRAMO);
    assert.ok(esperado.length > 1 && esperado.every((t) => t.length <= MAX_TRAMO));
    for (const max of [undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) assert.deepEqual(partirEnOraciones(texto, max), esperado);
  });

  it("un texto enorme y raro no lo cuelga", () => {
    const antes = performance.now();
    const raros = [".".repeat(300_000), "a. ".repeat(100_000), "…»".repeat(150_000), "x".repeat(300_000), "a, ".repeat(100_000), "… ".repeat(100_000), `${"… ".repeat(100_000)}fin`];
    for (const texto of raros) {
      for (const tramo of partirEnOraciones(texto)) assert.ok(tramo.length <= MAX_TRAMO);
    }
    assert.ok(performance.now() - antes < 3000, "tarda más de 3 s");
  });
});
