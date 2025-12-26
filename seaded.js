// seaded.js

async function laeSeaded() {
    const { data: veerud, error: vErr } = await sb
        .from("seaded_veerud")
        .select("*")
        .order("järjekord", { ascending: true });

    const { data: eripaevad, error: eErr } = await sb
        .from("eripaevad")
        .select("*");

    const eripaevObj = {};
    eripaevad?.forEach(p => {
        eripaevObj[p.kuupaev] = { nimi: p.nimi, värv: p.värv }; // ← PARANDATUD
    });

    return {
        veerud: veerud || [],
        eripaevad: eripaevObj
    };
}

// --- Seadete muutmine ---

async function lisaVeerg(nimi, pealkiri, hind, tüüp) {
    await sb.from("seaded_veerud").insert({
        nimi,
        pealkiri,
        hind,
        tüüp,
        järjekord: Date.now()
    });
}

async function kustutaVeerg(id) {
    await sb.from("seaded_veerud").delete().eq("id", id);
}

async function uuendaVeerg(id, muudatused) {
    await sb.from("seaded_veerud").update(muudatused).eq("id", id);
}

async function lisaEripaev(kuupaev, nimi, värv) { // ← PARANDATUD
    await sb.from("eripaevad").insert({ kuupaev, nimi, värv });
}

async function kustutaEripaev(kuupaev) { // ← PARANDATUD
    await sb.from("eripaevad").delete().eq("kuupaev", kuupaev);
}

