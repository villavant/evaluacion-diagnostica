// Envía al postulante el correo con el resultado de su autodiagnóstico.
// La invoca el trigger de public.resultados (ver migrations/) con { id, token }.
// El token es único por fila: sin él no se puede disparar ningún envío, y cada
// fila se envía una sola vez (se "reclama" pasando de 'pendiente' a 'enviando').
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const REMITENTE = "admisionposgrado@utec.edu.pe";
const REMITENTE_NOMBRE = "Admisión UTEC Posgrado";
const CON_COPIA = ["cramirezso@utec.edu.pe", "mcastillom@utec.edu.pe"];
const ASUNTO = "Resultado de tu autodiagnóstico de programación — Maestría en Ciencia de Datos e IA";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function mmss(seg: number): string {
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
function redactar(r: any): { text: string; html: string } {
  // El nombre lo escribe el postulante: se limpia de saltos de línea y se acota.
  const nombre = String(r.nombre ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const fecha = new Date(r.fin ?? r.creado_en).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "long",
    timeStyle: "short",
  });
  const tiempo = r.duracion_seg != null ? `${mmss(r.duracion_seg)} min` : null;

  const text = [
    `Hola, ${nombre}:`,
    "",
    "Gracias por completar el autodiagnóstico de programación de la Maestría en Ciencia de Datos e Inteligencia Artificial. Este es tu resultado:",
    "",
    `Puntaje total: ${r.puntaje_total} de 100`,
    `  - Parte I · Selección múltiple: ${r.puntaje_parte1} de 80`,
    `  - Parte II · Reto de programación: ${r.puntaje_reto1} de 20`,
    tiempo ? `Tiempo empleado: ${tiempo}` : null,
    `Fecha de envío: ${fecha} (hora de Lima)`,
    "",
    "Si tienes alguna consulta sobre tu resultado, responde a este correo.",
    "",
    "Admisión UTEC Posgrado",
  ].filter((l) => l !== null).join("\n");

  const fila = (label: string, valor: string) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #E4E4E4;color:#4E4B4C;">${label}</td>` +
    `<td style="padding:8px 0;border-bottom:1px solid #E4E4E4;text-align:right;font-weight:600;">${valor}</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background:#F8F8F8;">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;color:#1E1C1D;font-size:15px;line-height:1.55;">
  <div style="background:#1E1C1D;color:#ffffff;padding:20px 24px;border-top:4px solid #00E1FF;">
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#00E1FF;">Maestría en Ciencia de Datos e Inteligencia Artificial</div>
    <div style="font-size:20px;font-weight:700;margin-top:6px;">Autodiagnóstico de programación</div>
  </div>
  <div style="background:#ffffff;padding:24px;border:1px solid #E4E4E4;border-top:none;">
    <p style="margin:0 0 14px;">Hola, ${esc(nombre)}:</p>
    <p style="margin:0 0 18px;">Gracias por completar el autodiagnóstico de programación. Este es tu resultado:</p>
    <div style="text-align:center;margin:0 0 18px;">
      <span style="font-size:48px;font-weight:700;line-height:1;">${esc(r.puntaje_total)}</span><span style="font-size:18px;color:#6B6869;"> / 100</span>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14.5px;">
      ${fila("Parte I · Selección múltiple", `${esc(r.puntaje_parte1)} / 80`)}
      ${fila("Parte II · Reto de programación", `${esc(r.puntaje_reto1)} / 20`)}
      ${tiempo ? fila("Tiempo empleado", esc(tiempo)) : ""}
      ${fila("Fecha de envío", `${esc(fecha)} (hora de Lima)`)}
    </table>
    <p style="margin:20px 0 0;color:#6B6869;font-size:13.5px;">Si tienes alguna consulta sobre tu resultado, responde a este correo.</p>
  </div>
  <p style="margin:14px 0 0;color:#6B6869;font-size:12.5px;">Admisión UTEC Posgrado</p>
</div>
</body></html>`;

  return { text, html };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let id: number, token: string;
  try {
    const body = await req.json();
    id = Number(body.id);
    token = String(body.token ?? "");
  } catch {
    return json({ error: "Solicitud inválida" }, 400);
  }
  if (!Number.isSafeInteger(id) || !/^[0-9a-f-]{36}$/i.test(token)) {
    return json({ error: "Solicitud inválida" }, 400);
  }

  // Reclamo atómico: solo una invocación pasa de 'pendiente' a 'enviando'.
  const { data: filas, error: errReclamo } = await sb
    .from("resultados")
    .update({ correo_estado: "enviando", correo_error: null })
    .eq("id", id)
    .eq("correo_token", token)
    .eq("correo_estado", "pendiente")
    .select();
  if (errReclamo) return json({ error: "No se pudo leer el resultado" }, 500);
  if (!filas || filas.length === 0) return json({ ok: true, enviado: false });
  const r = filas[0];

  try {
    const user = Deno.env.get("SMTP_USER");
    const pass = Deno.env.get("SMTP_PASS");
    if (!user || !pass) throw new Error("Faltan los secretos SMTP_USER / SMTP_PASS");
    const port = Number(Deno.env.get("SMTP_PORT") ?? 465);

    const transporter = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const { text, html } = redactar(r);
    await transporter.sendMail({
      from: { name: REMITENTE_NOMBRE, address: REMITENTE },
      to: r.email,
      cc: CON_COPIA,
      subject: ASUNTO,
      text,
      html,
    });

    await sb.from("resultados")
      .update({ correo_estado: "enviado", correo_enviado_en: new Date().toISOString() })
      .eq("id", id);
    return json({ ok: true, enviado: true });
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await sb.from("resultados")
      .update({ correo_estado: "error", correo_error: msg })
      .eq("id", id);
    return json({ ok: false, error: "No se pudo enviar el correo" }, 500);
  }
});
