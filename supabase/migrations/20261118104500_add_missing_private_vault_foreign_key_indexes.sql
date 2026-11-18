create index if not exists persona_consents_user_id_idx on public.persona_consents (user_id);
create index if not exists persona_messages_user_id_idx on public.persona_messages (user_id);
create index if not exists wallet_records_asset_id_idx on public.wallet_records (asset_id);
