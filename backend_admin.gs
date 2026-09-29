/**
 * BACKEND — Evaluación Diagnóstica de Programación
 * Maestría en Ciencia de Datos e Inteligencia Artificial — UTEC Posgrado
 *
 * QUÉ HACE:
 *  Recibe cada envío del formulario (index.html), recalcula el puntaje en el
 *  servidor a partir de la clave de respuestas (no confía en lo que llega del
 *  navegador) y agrega una fila a la hoja "Respuestas" de este Google Sheet.
 *  Así el equipo de coordinación ve los resultados en una hoja de cálculo
 *  normal, sin depender de la interfaz de Google Forms.
 *
 * CÓMO DESPLEGARLO (una sola vez):
 *  1. Crea una Hoja de cálculo de Google nueva y vacía (será donde caigan
 *     los resultados). Ponle un nombre, ej. "Resultados — Evaluación Diagnóstica".
 *  2. Extensiones → Apps Script. Borra el contenido de Code.gs y pega TODO
 *     este archivo. Luego agrega otro archivo (+ → Secuencia de comandos)
 *     llamado "clave_respuestas" y pega ahí clave_respuestas.gs (no está en
 *     el repositorio público; pídelo a la coordinación).
 *  3. Arriba a la derecha, "Implementar" → "Nueva implementación".
 *  4. Tipo: "Aplicación web". Ejecutar como: "Yo". Quién tiene acceso:
 *     "Cualquier usuario" (así los postulantes externos pueden enviar sin
 *     iniciar sesión).
 *  5. Autoriza los permisos la primera vez.
 *  6. Copia la URL que termina en /exec — esa es tu API_URL.
 *  7. Pégala en la constante API_URL del <script> de index.html y vuelve a
 *     publicar index.html (GitHub Pages).
 *
 * IMPORTANTE: cada vez que edites este script después del primer despliegue,
 * usa "Implementar" → "Gestionar implementaciones" → ícono de lápiz →
 * "Nueva versión", o la URL /exec dejará de reflejar tus cambios.
 *
 * PUNTAJE (100 pts total):
 *  - 20 preguntas de selección múltiple (Parte I), 4 pts c/u = 80 pts.
 *  - 4 preguntas de conteo (Reto 1: 3 preguntas · Reto 2: 1 pregunta), 5 pts c/u = 20 pts.
 */

// ID de la Google Sheet donde se guardan los resultados. Es el texto entre
// /d/ y /edit en la URL de la hoja:
//   https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
const SHEET_ID = '';
const SHEET_NAME = 'Respuestas';
const PTS_MC = 4;
const PTS_RETO = 5;

// La clave de respuestas (const KEY) vive en clave_respuestas.gs, que NO se sube
// al repositorio público. Ambos archivos deben estar en el mismo proyecto de Apps Script.

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const score = calcularPuntaje(body);

    const sheet = getOrCreateSheet();
    sheet.appendRow([
      new Date(),
      body.nombre || '',
      body.lenguaje || '',
      body.experiencia || '',
      score.puntajeI,
      score.puntajeReto1,
      score.puntajeReto2,
      score.total,
      JSON.stringify(body.respuestasParteI || []),
      JSON.stringify(body.respuestasReto1 || {}),
      body.respuestaReto2 === null || body.respuestaReto2 === undefined ? '' : body.respuestaReto2,
    ]);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, total: score.total }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    'Servicio activo. Este endpoint solo acepta solicitudes POST desde el formulario de la Evaluación Diagnóstica.'
  );
}

function calcularPuntaje(body) {
  let puntajeI = 0;
  const respI = body.respuestasParteI || [];
  KEY.preguntas.forEach(function (p, i) {
    if (respI[i] === p.ok) puntajeI += PTS_MC;
  });

  let puntajeReto1 = 0;
  const respR1 = body.respuestasReto1 || {};
  KEY.reto1_preguntas.forEach(function (rp) {
    if (respR1[rp.id] === rp.ok) puntajeReto1 += PTS_RETO;
  });

  const puntajeReto2 = (body.respuestaReto2 === KEY.reto2_ok) ? PTS_RETO : 0;

  return {
    puntajeI: puntajeI,
    puntajeReto1: puntajeReto1,
    puntajeReto2: puntajeReto2,
    total: puntajeI + puntajeReto1 + puntajeReto2,
  };
}

/**
 * Usa la hoja indicada en SHEET_ID; si está vacío, la hoja vinculada al script
 * (cuando se creó desde Extensiones → Apps Script).
 */
function getSpreadsheet() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('Configura SHEET_ID con el ID de la Google Sheet de resultados.');
}

function getOrCreateSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Fecha y hora', 'Nombre', 'Lenguaje', 'Experiencia',
      'Puntaje Parte I (/80)', 'Puntaje Reto 1 (/15)', 'Puntaje Reto 2 (/5)', 'Puntaje Total (/100)',
      'Respuestas Parte I (JSON)', 'Respuestas Reto 1 (JSON)', 'Respuesta Reto 2 (índice)',
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Prueba manual: selecciona esta función en el desplegable y pulsa "Ejecutar"
 * para agregar una fila de prueba sin pasar por el formulario web.
 */
function pruebaManual() {
  const bodyDeEjemplo = {
    nombre: 'Prueba Manual',
    lenguaje: 'Python',
    experiencia: 'De 1 a 3 años',
    respuestasParteI: KEY.preguntas.map(function (p) { return p.ok; }), // todas correctas
    respuestasReto1: { r1a: KEY.reto1_preguntas[0].ok, r1b: KEY.reto1_preguntas[1].ok, r1c: KEY.reto1_preguntas[2].ok },
    respuestaReto2: KEY.reto2_ok,
  };
  doPost({ postData: { contents: JSON.stringify(bodyDeEjemplo) } });
  Logger.log('Fila de prueba agregada (debería mostrar 100/100) en: ' + getSpreadsheet().getUrl());
}
