// --- SUPABASE ÜHENDUS ---
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://aoxlxulsqdzkzsntxasw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZmgEFvenYT2jVxvShMH_VA_4YrNYPo0";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

export { sb };






