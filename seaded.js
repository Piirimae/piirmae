// seaded.js (MOODUL)
import { sb } from "./supabase.js";

export async function laeSeaded() {
    const { data: veerud } = await sb
        .from("seaded_veerud")
        .select("*")
        .order("järjekord", { ascending: true });

    const { data: eripaevad } = await sb
        .from("eripaevad")
        .select("*");

    const eripaevObj = {};
    eripaevad?.forEach(p => {
        eripaevObj[p.kuupaev] = { nimi: p.nimi, värv: p.värv };
    });

    return {
        veerud: veerud || [],
        eripaevad: eripaevObj
    };
}

export async function lisaVeerg(nimi, pealkiri, hind, tüüp) {
    await sb.from("seaded_veerud").insert({
        nimi,
        pealkiri,
        hind,
        tüüp,
        järjekord: Date.now()
    });
}

export async function kustutaVeerg(id) {
    await sb.from("seaded_veerud").delete().eq("id", id);
}

// ✅ PARANDATUD JA HALDATUD: Hinnaajaloo automaatne salvestamine
export async function uuendaVeerg(id, muudatused) {
    // 1. Uuendame veergude põhitabelit seaded_veerud
    await sb.from("seaded_veerud").update(muudatused).eq("id", id);

    // 2. Kui muudatus sisaldab 'hind' lahtrit, fikseerime selle tabelisse 'hinnad'
    if (muudatused.hind !== undefined) {
        try {
            // Küsime seadete tabelist veeru nime (nimi), et teada, mis tootega on tegu
            const { data: veerg } = await sb
                .from("seaded_veerud")
                .select("nimi")
                .eq("id", id)
                .single();

            if (veerg) {
                const toiduNimi = veerg.nimi;
                const uueHinnaVäärtus = Number(muudatused.hind) || 0;
                const praeguneAeg = new Date().toISOString();

                // A. Sulgeme eelmise selle toidu hinnaperioodi, märkides kehtiv_kuni = NOW()
                await sb.from("hinnad")
                    .update({ kehtiv_kuni: praeguneAeg })
                    .eq("nimi", toiduNimi)
                    .is("kehtiv_kuni", null);

                // B. Sisestame uue rea värske hinnaga, mis jääb avatuks (kehtiv_kuni = null)
                await sb.from("hinnad").insert({
                    nimi: toiduNimi,
                    hind: uueHinnaVäärtus,
                    kehtiv_alates: praeguneAeg,
                    kehtiv_kuni: null
                });

                console.log(`[HINNA AJALUGU] Toode: ${toiduNimi}, Uus hind: ${uueHinnaVäärtus} €`);
            }
        } catch (err) {
            console.error("Viga hinnaajaloo salvestamisel:", err);
        }
    }
}

export async function lisaEripaev(kuupaev, nimi, värv) {
    await sb.from("eripaevad").insert({ kuupaev, nimi, värv });
}

export async function kustutaEripaev(kuupaev) {
    await sb.from("eripaevad").delete().eq("kuupaev", kuupaev);
}







