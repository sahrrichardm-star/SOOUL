import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "https://sooull.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401, { error: "Sign in again before deleting your account." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: "Account deletion is not configured on the server." });
  }

  const token = authorization.slice("Bearer ".length);
  const verifier = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await verifier.auth.getUser(token);
  if (authError || !user) return json(401, { error: "Your session is invalid. Sign in again." });

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return json(401, { error: "Your session is invalid. Sign in again." });
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    const authTime = Number(payload.auth_time);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(authTime) || authTime > now + 30 || now - authTime > 600) {
      return json(403, { error: "For your protection, complete a fresh sign-in immediately before deleting your account." });
    }
    const { data: factorData, error: factorError } = await verifier.auth.mfa.listFactors();
    if (factorError) return json(503, { error: "Your multi-factor status could not be verified. Try again shortly." });
    const verifiedFactors = [...(factorData?.totp ?? []), ...(factorData?.phone ?? [])]
      .filter((factor) => factor.status === "verified");
    if (verifiedFactors.length > 0 && payload.aal !== "aal2") {
      return json(403, { error: "Complete your multi-factor authentication challenge before deleting your account." });
    }
  } catch {
    return json(401, { error: "Your session could not be validated. Sign in again." });
  }

  let confirmation: unknown;
  try {
    const body = await request.json();
    confirmation = body?.confirmation;
  } catch {
    return json(400, { error: "A deletion confirmation is required." });
  }
  if (confirmation !== "DELETE") return json(400, { error: "Type DELETE to confirm account deletion." });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json(500, { error: "Your account could not be deleted. Contact SOOULL support." });

  return json(200, { success: true });
});
