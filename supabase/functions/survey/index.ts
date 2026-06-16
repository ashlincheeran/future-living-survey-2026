import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_HTML_URL = `${SUPABASE_URL}/storage/v1/object/public/site/index.html`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (req.method === "GET") {
    const upstream = await fetch(PUBLIC_HTML_URL, { cache: "no-store" });
    const body = await upstream.arrayBuffer();
    const h = new Headers();
    h.set("Content-Type", "text/html; charset=utf-8");
    h.set("Cache-Control", "public, max-age=60");
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(body, { status: 200, headers: h });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const supa = createClient(SUPABASE_URL, SERVICE_KEY);
      const { error } = await supa.from("survey_responses").insert({
        full_name:        String(body.full_name || "").slice(0, 200),
        email:            String(body.email || "").slice(0, 200),
        phone:            String(body.phone || "").slice(0, 30),
        marketing_opt_in: !!body.marketing_opt_in,
        consent:          !!body.consent,
        emirate:          body.emirate || null,
        tenure:           body.tenure || null,
        living_situation: body.living_situation || null,
        wants_valuation:  body.wants_valuation || null,
        user_agent:       String(body.user_agent || "").slice(0, 500),
        referrer:         body.referrer || null,
        responses:        body.responses || {},
      });
      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
          status: 500, headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS },
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405, headers: CORS });
});
