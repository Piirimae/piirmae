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

export async function uuendaVeerg(id, muudatused) {
    await sb.from("seaded_veerud").update(muudatused).eq("id", id);
}

export async function lisaEripaev(kuupaev, nimi, värv) {
    await sb.from("eripaevad").insert({ kuupaev, nimi, värv });
}

export async function kustutaEripaev(kuupaev) {
    await sb.from("eripaevad").delete().eq("kuupaev", kuupaev);
}






