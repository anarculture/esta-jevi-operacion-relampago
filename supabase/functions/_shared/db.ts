import { createClient } from "npm:@supabase/supabase-js@2.45.4";

export const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Envuelve un handler: responde el preflight CORS y convierte excepciones en 500 con mensaje.
// maxBytes: cuerpos más largos se rechazan con 413 antes de parsearlos.
export function serve(handler: (body: Record<string, unknown>) => Promise<Response>, maxBytes = Infinity) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    try {
      const text = req.method === "POST" ? await req.text() : "{}";
      if (text.length > maxBytes) return json({ error: "cuerpo_muy_grande" }, 413);
      return await handler(JSON.parse(text));
    } catch (e) {
      console.error(e);
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });
}
