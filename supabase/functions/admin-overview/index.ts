import { createClient } from "npm:@supabase/supabase-js@2";

const configuredOrigin = Deno.env.get("APP_ORIGIN") ?? "https://sooull.vercel.app";
const allowedOrigins = new Set([configuredOrigin, "http://localhost:5173"]);

function headers(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : configuredOrigin;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function json(status: number, data: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." }, origin);
  if (origin && !allowedOrigins.has(origin)) return json(403, { error: "Origin is not allowed." }, origin);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token) return json(401, { error: "Sign in is required." }, origin);
  if (!url || !anonKey || !serviceKey) return json(503, { error: "Administrator service is not configured." }, origin);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serverClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json(401, { error: "Your session is invalid. Sign in again." }, origin);

    const [{ data: role, error: roleError }, { data: assurance, error: assuranceError }] = await Promise.all([
      userClient.rpc("current_admin_role"),
      userClient.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (roleError) {
      console.error("admin role check failed", roleError);
      return json(503, { error: "Administrator authorization could not be checked." }, origin);
    }
    if (!role) return json(403, { error: "This account is not authorized for SOOULL administration." }, origin);
    if (assuranceError || assurance?.currentLevel !== "aal2") {
      return json(403, { error: "Administrator access requires a verified second authentication factor." }, origin);
    }

    const { data: metrics, error: metricsError } = await serverClient.rpc("admin_metrics");
    if (metricsError) {
      console.error("admin metrics query failed", metricsError);
      return json(503, { error: "Platform metrics are temporarily unavailable." }, origin);
    }

    const { error: auditError } = await serverClient.rpc("admin_record_audit", {
      p_actor_id: authData.user.id,
      p_action: "admin.dashboard.viewed",
      p_target_user_id: null,
      p_details: { role },
    });
    if (auditError) {
      console.error("admin audit write failed", auditError);
      return json(503, { error: "Administrator audit logging is unavailable. Dashboard access is paused." }, origin);
    }

    return json(200, {
      role,
      metrics: metrics ?? {},
      generatedAt: new Date().toISOString(),
    }, origin);
  } catch (error) {
    console.error("admin-overview failed", error);
    return json(500, { error: "The administrator dashboard could not be loaded." }, origin);
  }
});
