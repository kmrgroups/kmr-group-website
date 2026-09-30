// Server errors → Console › System health; one alert email per new error per hour (ALERT_EMAIL). Never throws.
export async function register() {}

export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routeType: string; routePath: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const e = err as Error & { digest?: string };
    if (/NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR|DYNAMIC_SERVER_USAGE/.test(`${e?.message} ${e?.digest}`)) return;
    const [{ supabaseAdmin }, { alertEmail, sendMail }] = await Promise.all([import("./lib/supabaseAdmin"), import("./lib/mail")]);
    const message = (e?.message || String(e)).slice(0, 1000), path = `${request.method} ${request.path}`.slice(0, 300);
    const { data: isNew } = await supabaseAdmin().rpc("kmr_log_error", {
      p_app: "website", p_path: path, p_message: message, p_digest: e?.digest ?? null, p_detail: [`${context.routeType} ${context.routePath}`, e?.stack].filter(Boolean).join("\n").slice(0, 4000),
    });
    if (isNew === true) await sendMail({ kind: "error_alert", to: await alertEmail(), subject: `[website] Error: ${message.slice(0, 80)}`, heading: "Something went wrong on the website",
      paragraphs: ["This error is recorded in Console › System health. You get one email per error per hour."], rows: [["Page", path], ["Error", message.slice(0, 300)]] });
  } catch { /* ignore */ }
}
