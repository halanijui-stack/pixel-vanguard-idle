-- ============================================================
-- Pixel Vanguard Idle — Setup do Supabase (chat global)
-- Cole isto no SQL Editor do Supabase e clique em RUN.
-- ============================================================

-- 1) Tabela de mensagens do chat
create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  type        text        not null default 'msg',   -- 'msg' | 'alert' | 'synth'
  nick        text        not null,
  msg         text,
  item        text,
  rar         text,
  created_at  timestamptz not null default now()
);

-- índice para ordenar por data rapidamente
create index if not exists messages_created_at_idx
  on public.messages (created_at);

-- 2) Ativa o Realtime nesta tabela (envia eventos de INSERT)
alter publication supabase_realtime add table public.messages;

-- 3) Row Level Security (RLS): protege a tabela.
-- A anon key é pública, então limitamos o que ela pode fazer.
alter table public.messages enable row level security;

-- qualquer um pode LER o chat
create policy "leitura publica do chat"
  on public.messages for select
  using (true);

-- qualquer um pode ENVIAR mensagem (INSERT), mas com limites:
--  - nick entre 2 e 24 caracteres
--  - msg no máximo 200 caracteres
create policy "envio publico com limites"
  on public.messages for insert
  with check (
    char_length(nick) between 2 and 24
    and (msg is null or char_length(msg) <= 200)
  );

-- (NÃO criamos policies de UPDATE/DELETE: ninguém pode editar
--  nem apagar mensagens dos outros pela anon key.)

-- 4) (Opcional) Limpeza automática: manter só as 500 mensagens
--    mais recentes. Rode manualmente de vez em quando, ou
--    configure um cron no Supabase (Database > Cron).
-- delete from public.messages
-- where id not in (
--   select id from public.messages order by created_at desc limit 500
-- );
