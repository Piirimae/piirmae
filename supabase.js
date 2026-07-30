// --- SUPABASE ÜHENDUS ---
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://aoxlxulsqdzkzsntxasw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZmgEFvenYT2jVxvShMH_VA_4YrNYPo0";
// 🔒 Sinu salajane service_role võti kontode haldamiseks:
const SUPABASE_SECRET_KEY = "sb_secret__kEQibgrYpCoVHIQdWQrjQ_h-HfWZpF";

// Tavaline klient tavaliste päringute jaoks (sisseloginud kasutajale)
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// 🛠️ Admin-klient kasutajate eelregistreerimiseks ja kutsumiseks
const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export { sb, sbAdmin }; // 👈 Ekspordime mõlemad kliendid







