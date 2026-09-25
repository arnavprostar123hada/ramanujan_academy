import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Not signed in" }, 401);
    const { data: isOwner } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "owner" });
    if (!isOwner) return json({ error: "Only the owner can do this" }, 403);

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { name, email, password, phone } = body;
      if (!name || !email || !password || password.length < 6)
        return json({ error: "Name, email and a password of at least 6 characters are required" }, 400);
      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (error) return json({ error: error.message }, 400);
      const uid = created.user.id;
      await admin.from("user_roles").insert({ user_id: uid, role: "admin" });
      const { error: e2 } = await admin.from("admin_staff").insert({ user_id: uid, name, email, phone: phone || null });
      if (e2) return json({ error: e2.message }, 400);
      return json({ success: true });
    }

    if (action === "set_active") {
      const { staffId, isActive } = body;
      const { data: s } = await admin.from("admin_staff").select("user_id").eq("id", staffId).single();
      if (!s) return json({ error: "Not found" }, 404);
      await admin.from("admin_staff").update({ is_active: isActive }).eq("id", staffId);
      if (isActive) {
        await admin.from("user_roles").upsert({ user_id: s.user_id, role: "admin" }, { onConflict: "user_id,role" });
      } else {
        await admin.from("user_roles").delete().eq("user_id", s.user_id).eq("role", "admin");
      }
      return json({ success: true });
    }

    if (action === "reset_password") {
      const { staffId, password } = body;
      if (!password || password.length < 6) return json({ error: "Password must be 6+ characters" }, 400);
      const { data: s } = await admin.from("admin_staff").select("user_id").eq("id", staffId).single();
      if (!s) return json({ error: "Not found" }, 404);
      const { error } = await admin.auth.admin.updateUserById(s.user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "delete") {
      const { staffId } = body;
      const { data: s } = await admin.from("admin_staff").select("user_id").eq("id", staffId).single();
      if (!s) return json({ error: "Not found" }, 404);
      await admin.auth.admin.deleteUser(s.user_id);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
