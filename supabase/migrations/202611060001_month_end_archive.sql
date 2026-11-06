-- Automaatne kuu lõpparhiiv ja logi salvestatakse ühe DB-tehinguna.
-- Käsitsi arhiive (paeritolu != 'automaatne') see piirang ei puuduta.

create unique index if not exists arhiiv_one_automatic_month_idx
    on public.arhiiv (kuu_id)
    where paeritolu = 'automaatne';

create or replace function public.insert_month_end_archive(
    p_kuu_id text,
    p_arhiivi_id text,
    p_state jsonb,
    p_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
        raise exception 'service_role is required';
    end if;

    -- Tagab sama kuu paralleelsete kutsete serialiseerimise.
    perform pg_advisory_xact_lock(hashtext(p_kuu_id));

    if exists (
        select 1 from public.arhiiv
        where kuu_id = p_kuu_id and paeritolu = 'automaatne'
    ) then
        return jsonb_build_object('created', false, 'reason', 'already_archived');
    end if;

    insert into public.arhiiv (
        "arhiiviId", kuu_id, state, salvestaja, paeritolu, taastatud, versioon, created_at
    ) values (
        p_arhiivi_id, p_kuu_id, p_state, 'automaatne', 'automaatne', false, 1, p_created_at
    );

    insert into public.logid (user_email, tegevus, detailid)
    values (
        'automaatne',
        'kuu_loppseis_automaatne',
        jsonb_build_object(
            'kuu', p_kuu_id,
            'arhiiviId', p_arhiivi_id,
            'paeritolu', 'automaatne',
            'allikas', 'supabase_cron',
            'versioon', 1,
            'teade', format('Kuu %s lõppseis arhiveeriti automaatselt.', p_kuu_id)
        )
    );

    return jsonb_build_object('created', true, 'arhiiviId', p_arhiivi_id, 'versioon', 1);
end;
$$;

revoke all on function public.insert_month_end_archive(text, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.insert_month_end_archive(text, text, jsonb, timestamptz) to service_role;
