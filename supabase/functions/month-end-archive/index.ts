import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-archive-cron-secret",
};

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, "Content-Type": "application/json" },
});

function eelmineKuu(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function tallinnaKeskööUtc(kuupaev: string): number {
  const siht = new Date(`${kuupaev}T00:00:00.000Z`).getTime();
  let kandidaat = siht;
  const vormindaja = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tallinn",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });

  for (let i = 0; i < 3; i++) {
    const osad = Object.fromEntries(vormindaja.formatToParts(new Date(kandidaat)).map(p => [p.type, p.value]));
    const kohalikUtc = Date.UTC(Number(osad.year), Number(osad.month) - 1, Number(osad.day), Number(osad.hour), Number(osad.minute), Number(osad.second));
    const vahe = siht - kohalikUtc;
    kandidaat += vahe;
    if (vahe === 0) break;
  }
  return kandidaat;
}

const eur = (summa: number) => `${summa.toFixed(2)} €`;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const cronSaladus = Deno.env.get("ARCHIVE_CRON_SECRET");
  if (!cronSaladus || request.headers.get("x-archive-cron-secret") !== cronSaladus) {
    return respond({ error: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return respond({ error: "Supabase function secrets missing" }, 500);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const body = await request.json().catch(() => ({}));
    // Cron saadab tühja body ja arhiveerib eelmise kuu. Käsitsi testimiseks
    // võib sama saladusega määrata kuu ning dry_run=true; see ei kirjuta andmeid.
    const kuuId = typeof body.kuu_id === "string" ? body.kuu_id : eelmineKuu();
    const dryRun = body.dry_run === true;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(kuuId)) return respond({ error: "kuu_id must be YYYY-MM" }, 400);

    const { data: olemas, error: olemasErr } = await supabase
      .from("arhiiv").select("arhiiviId").eq("kuu_id", kuuId).eq("paeritolu", "automaatne").limit(1);
    if (olemasErr) throw olemasErr;
    if (olemas?.length) return respond({ ok: true, skipped: true, kuu_id: kuuId, reason: "automatic_archive_exists" });

    const [{ data: kassa, error: kassaErr }, { data: veerud, error: veerudErr }, { data: hinnad, error: hinnadErr }] = await Promise.all([
      supabase.from("kassatabel").select("*").eq("kuu_id", kuuId).order("kuupaev", { ascending: true }),
      supabase.from("seaded_veerud").select("*").order("järjekord", { ascending: true }),
      supabase.from("hinnad").select("*"),
    ]);
    if (kassaErr) throw kassaErr;
    if (veerudErr) throw veerudErr;
    if (hinnadErr) throw hinnadErr;
    if (!kassa?.length) return respond({ ok: true, skipped: true, kuu_id: kuuId, reason: "no_kassatabel_rows" });
    if (!veerud?.length) throw new Error("Kassa veeruseaded puuduvad.");

    const ridadeKuupaev = new Map<string, Record<string, unknown>>();
    for (const r of kassa) ridadeKuupaev.set(String(r.kuupaev).split("T")[0], r);

    const [aasta, kuu] = kuuId.split("-").map(Number);
    const paevadeArv = new Date(Date.UTC(aasta, kuu, 0)).getUTCDate();
    const sumKogus = veerud.map(() => 0);
    const sumHind = veerud.map(() => 0);
    let kuuKokku = 0;

    const leiaHind = (nimi: string, kuupaev: string, vaikeHind: unknown) => {
      const target = tallinnaKeskööUtc(kuupaev);
      const vaste = (hinnad ?? []).find(h => h.nimi === nimi && target >= Date.parse(h.kehtiv_alates) && target <= (h.kehtiv_kuni ? Date.parse(h.kehtiv_kuni) : Infinity));
      return vaste ? Number(vaste.hind) || 0 : Number(vaikeHind) || 0;
    };

    const rows = [];
    for (let paev = 1; paev <= paevadeArv; paev++) {
      const kuupaev = `${kuuId}-${String(paev).padStart(2, "0")}`;
      const allikas = ridadeKuupaev.get(kuupaev) ?? {};
      const values = veerud.map((v, idx) => {
        const raw = allikas[v.nimi];
        const value = v.tüüp === "toit" || v.tüüp === "number" ? Number(raw) || 0 : (raw == null ? "" : String(raw));
        if (v.tüüp === "toit" || v.tüüp === "number") sumKogus[idx] += Number(value) || 0;
        if (v.tüüp === "toit") sumHind[idx] += (Number(value) || 0) * leiaHind(v.nimi, kuupaev, v.hind);
        return value;
      });
      const total = veerud.reduce((sum, v, idx) => v.tüüp === "toit" ? sum + (Number(values[idx]) || 0) * leiaHind(v.nimi, kuupaev, v.hind) : sum, 0);
      kuuKokku += total;
      rows.push({ kuupäev: kuupaev, veerud: values, kokku: eur(total) });
    }

    const state = {
      kuu: kuuId,
      paise: veerud.map(v => ({ nimi: v.nimi, pealkiri: v.pealkiri, hind: v.hind ?? null, tüüp: v.tüüp })),
      rows,
      sumKogus: sumKogus.map(String),
      sumHind: veerud.map((v, i) => v.tüüp === "toit" ? eur(sumHind[i]) : "-"),
      kuuKokku: eur(kuuKokku),
    };

    if (dryRun) return respond({ ok: true, dry_run: true, kuu_id: kuuId, row_count: rows.length, state });

    const now = new Date();
    const arhiiviId = `arh_${kuuId}_${now.toISOString().replace(/[-:.TZ]/g, "")}`;
    const { data: tulemus, error: rpcErr } = await supabase.rpc("insert_month_end_archive", {
      p_kuu_id: kuuId,
      p_arhiivi_id: arhiiviId,
      p_state: state,
      p_created_at: now.toISOString(),
    });
    if (rpcErr) throw rpcErr;
    return respond({ ok: true, kuu_id: kuuId, ...tulemus });
  } catch (error) {
    console.error("Month-end archive error:", error);
    return respond({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
