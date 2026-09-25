import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Not signed in" }, 401);

    const { data: ownerProfile, error: ownerError } = await admin
      .from("user_profiles")
      .select("role, active")
      .eq("id", authData.user.id)
      .single();

    if (ownerError || ownerProfile?.active !== true || ownerProfile.role !== "owner") {
      return json({ error: "Only the owner can do this" }, 403);
    }

    const body = await req.json();
    const action = body?.action;

    if (action === "create") {
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const phone = String(body.phone ?? "").trim();

      if (!name || !email || !password || password.length < 6) {
        return json({ error: "Name, email and a password of at least 6 characters are required" }, 400);
      }

      let uid: string | undefined;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (listError) return json({ error: createError.message }, 400);

        const existing = users.users.find((u) => u.email?.toLowerCase() === email);
        if (!existing) return json({ error: createError.message }, 400);

        uid = existing.id;

        const { data: existingStaff } = await admin
          .from("admin_staff")
          .select("id")
          .eq("user_id", uid)
          .maybeSingle();

        if (existingStaff) {
          return json({ error: "This person is already an admin staff member" }, 400);
        }

        const { error: passwordError } = await admin.auth.admin.updateUserById(uid, { password });
        if (passwordError) return json({ error: passwordError.message }, 400);
      } else {
        uid = created.user?.id;
      }

      if (!uid) return json({ error: "Unable to create user" }, 500);

      const { error: profileError } = await admin.from("user_profiles").upsert(
        {
          id: uid,
          full_name: name,
          role: "admin",
          phone: phone || null,
          active: true,
        },
        { onConflict: "id" }
      );

      if (profileError) return json({ error: profileError.message }, 400);

      const { error: staffError } = await admin.from("admin_staff").insert({
        user_id: uid,
        name,
        email,
        phone: phone || null,
        is_active: true,
      });

      if (staffError) {
        await admin.from("user_profiles").delete().eq("id", uid);
        return json({ error: staffError.message }, 400);
      }

      return json({ success: true, user_id: uid });
    }

    if (action === "set_active") {
      const { staffId, isActive } = body;
      const { data: staff, error: staffError } = await admin
        .from("admin_staff")
        .select("user_id")
        .eq("id", staffId)
        .single();

      if (staffError || !staff) return json({ error: "Not found" }, 404);

      const { error: staffUpdateError } = await admin
        .from("admin_staff")
        .update({ is_active: !!isActive })
        .eq("id", staffId);

      if (staffUpdateError) return json({ error: staffUpdateError.message }, 400);

      const { error: profileUpdateError } = await admin
        .from("user_profiles")
        .update({ active: !!isActive })
        .eq("id", staff.user_id);

      if (profileUpdateError) return json({ error: profileUpdateError.message }, 400);

      return json({ success: true });
    }

    if (action === "reset_password") {
      const { staffId, password } = body;
      if (!password || String(password).length < 6) {
        return json({ error: "Password must be 6+ characters" }, 400);
      }

      const { data: staff, error: staffError } = await admin
        .from("admin_staff")
        .select("user_id")
        .eq("id", staffId)
        .single();

      if (staffError || !staff) return json({ error: "Not found" }, 404);

      const { error: passwordError } = await admin.auth.admin.updateUserById(staff.user_id, {
        password: String(password),
      });

      if (passwordError) return json({ error: passwordError.message }, 400);
      return json({ success: true });
    }

    if (action === "delete") {
      const { staffId } = body;
      const { data: staff, error: staffError } = await admin
        .from("admin_staff")
        .select("user_id")
        .eq("id", staffId)
        .single();

      if (staffError || !staff) return json({ error: "Not found" }, 404);

      const { error: deleteError } = await admin.auth.admin.deleteUser(staff.user_id);
      if (deleteError) return json({ error: deleteError.message }, 400);

      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});