import { supabase } from "@/client/supabase";

// ── Schemes ──────────────────────────────────────────────────
export async function fetchSchemes(category?: string, search?: string) {
  let q = supabase.from("schemes").select("*").eq("is_active", true).limit(100);
  if (category) q = q.eq("category", category);
  if (search) {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const orParts = [
      `name.ilike.%${search}%`,
      `description.ilike.%${search}%`,
      ...words.map((w) => `name.ilike.%${w}%`),
      ...words.map((w) => `description.ilike.%${w}%`),
    ];
    q = q.or(orParts.join(","));
  }
  const { data, error } = await q;
  if (error) throw error;
  let results = Array.isArray(data) ? data : [];

  if (search) {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    results = results
      .map((s) => {
        const name = (s.name as string).toLowerCase();
        const desc = (s.description as string).toLowerCase();
        const keywords: string[] = (s.keywords as string[]) ?? [];
        let score = 0;
        if (name === search.toLowerCase()) score += 100;
        if (name.includes(search.toLowerCase())) score += 40;
        for (const w of words) {
          if (name.includes(w)) score += 15;
          if (keywords.some((k) => k.toLowerCase().includes(w))) score += 10;
          if (desc.includes(w)) score += 3;
        }
        return { ...s, _score: score };
      })
      .filter((s) => s._score > 0)
      .sort((a, b) => b._score - a._score);
  } else {
    results = results.sort((a, b) => (a.name as string).localeCompare(b.name as string));
  }

  return results.slice(0, 50);
}

export async function fetchSchemeById(id: string) {
  const { data, error } = await supabase.from("schemes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function searchSchemesByIntent(keywords: string[]) {
  const keywordList = keywords.map((k) => k.toLowerCase());
  const { data, error } = await supabase
    .from("schemes")
    .select("*")
    .eq("is_active", true)
    .limit(50);
  if (error) throw error;
  const schemes = Array.isArray(data) ? data : [];

  // Score each scheme
  return schemes
    .map((s) => {
      let score = 0;
      const schemeKeywords: string[] = s.keywords ?? [];
      const schemeText = `${s.name} ${s.description} ${s.category} ${schemeKeywords.join(" ")}`.toLowerCase();
           for (const kw of keywordList) {
        if (schemeText.includes(kw)) score += 3;
        if (schemeKeywords.some((sk: string) => sk.toLowerCase() === kw)) score += 12;
        else if (schemeKeywords.some((sk: string) => sk.toLowerCase().includes(kw))) score += 5;
      }
      return { ...s, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

// ── Bookmarks ────────────────────────────────────────────────
export async function fetchBookmarks(userId: string) {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("scheme_id, created_at, schemes!bookmarks_scheme_id_fkey(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function toggleBookmark(userId: string, schemeId: string) {
  const { data: existing } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("scheme_id", schemeId)
    .maybeSingle();
  if (existing) {
    await supabase.from("bookmarks").delete().eq("user_id", userId).eq("scheme_id", schemeId);
    return false;
  } else {
    await supabase.from("bookmarks").insert({ user_id: userId, scheme_id: schemeId });
    return true;
  }
}

export async function isBookmarked(userId: string, schemeId: string) {
  const { data } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("scheme_id", schemeId)
    .maybeSingle();
  return !!data;
}

// ── Demo Applications ────────────────────────────────────────
export async function fetchApplications(userId: string) {
  const { data, error } = await supabase
    .from("demo_applications")
    .select("*")
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createApplication(userId: string, schemeId: string, schemeName: string) {
  const { data, error } = await supabase
    .from("demo_applications")
    .insert({
      user_id: userId,
      scheme_id: schemeId,
      scheme_name: schemeName,
      status: "submitted",
    })
    .select("id, submitted_at")
    .single();
  if (error) throw error;
  return data;
}

// ── District Data ────────────────────────────────────────────
export async function fetchDistrictData(state?: string, district?: string, schemeId?: string, fy?: string) {
  let q = supabase
    .from("district_scheme_data")
    .select("*")
    .eq("financial_year", fy || "2024-25")
    .order("state")
    .limit(200);
  if (state) q = q.eq("state", state);
  if (district) q = q.eq("district", district);
  if (schemeId) q = q.eq("scheme_id", schemeId);
  const { data, error } = await q;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function updateDistrictData(id: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("district_scheme_data").update(updates).eq("id", id);
  if (error) throw error;
}

// ── RTI Queries ───────────────────────────────────────────────
export async function submitRtiQuery(payload: {
  name: string;
  contact: string;
  subject: string;
  description: string;
}) {
  const ref = `RTI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { error } = await supabase.from("rti_queries").insert({ ...payload, reference_number: ref });
  if (error) throw error;
  return ref;
}

// Alias used by rti.tsx
export async function submitRTIQuery(
  name: string,
  contact: string,
  subject: string,
  description: string,
) {
  return submitRtiQuery({ name, contact, subject, description });
}

// ── News ──────────────────────────────────────────────────────
export async function fetchNews() {
  const { data, error } = await supabase
    .from("news_updates")
    .select("*")
    .eq("is_active", true)
    .order("published_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ── Profile ───────────────────────────────────────────────────
export async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  if (error) throw error;
}

// ── SMS Simulation (Free, no real SMS sent) ────────────────────
export async function logSimulatedSms(
  userId: string,
  applicationId: string | null,
  phoneDisplay: string,
  messageBody: string
) {
  const { error } = await supabase.from("sms_log").insert({
    user_id: userId,
    application_id: applicationId,
    phone_display: phoneDisplay,
    message_body: messageBody,
    status: "simulated",
  });
  if (error) throw error;
}
