// --- SUPABASE ÜHENDUS ---
import { createClient } from "https://jsdelivr.net";

const SUPABASE_URL = "https://aoxlxulsqdzkzsntxasw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZmgEFvenYT2jVxvShMH_VA_4YrNYPo0";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

export { sb }; // Jätame ainult tavalise sb kliendi








