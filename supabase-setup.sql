-- ============================================================
-- Pixel Vanguard Idle — Setup do Supabase
-- Cole isto no SQL Editor do Supabase e clique em RUN.
-- ============================================================

-- 0) Tabela de usuários e autenticação
create table if not exists public.users (
  id          bigint generated always as identity primary key,
  nick        text        not null unique,
  password    text        not null,  -- hash bcrypt
  game_data   jsonb       not null default '{}',  -- estado completo do jogo (S)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- constraint: proibir prefixos reservados ADM, GM, CM
  constraint nick_no_reserved_prefix check (
    lower(nick) NOT LIKE 'adm%' AND
    lower(nick) NOT LIKE 'gm%' AND
    lower(nick) NOT LIKE 'cm%'
  )
);

-- índice no nick para buscas rápidas
create index if not exists users_nick_idx on public.users (nick);

-- 2) Trigger como fallback: valida prefixos reservados (ADM, GM, CM)
-- se a constraint CHECK não funcionar, este trigger garante
-- EXCEÇÃO: ADM-SOUL é permitido (usuário administrativo reservado)
create or replace function validate_nick_prefix()
returns trigger as $$
begin
  -- permitir ADM-SOUL como exceção
  if lower(new.nick) = 'adm-soul' then
    return new;
  end if;
  -- bloquear outros com prefixos ADM, GM, CM
  if lower(new.nick) like 'adm%' or lower(new.nick) like 'gm%' or lower(new.nick) like 'cm%' then
    raise exception 'Nicknames com prefixos ADM, GM ou CM são reservados!';
  end if;
  return new;
end;
$$ language plpgsql;

-- executar trigger antes de INSERT ou UPDATE
drop trigger if exists check_nick_prefix on public.users;
create trigger check_nick_prefix
  before insert or update on public.users
  for each row
  execute function validate_nick_prefix();

-- 2) Row Level Security para a tabela de usuários
alter table public.users enable row level security;

-- leitura: qualquer um pode ler (para verificar disponibilidade de nick)
create policy "leitura publica de usuarios"
  on public.users for select
  using (true);

-- INSERT (novo usuário): qualquer um pode criar MAS não com prefixos reservados
create policy "criar novo usuario"
  on public.users for insert
  with check (
    char_length(nick) between 2 and 12
    and char_length(password) >= 20  -- hash bcrypt mínimo
    -- dupla validação: proibir ADM, GM, CM (exceto ADM-SOUL via trigger)
    and lower(nick) not like 'adm%'
    and lower(nick) not like 'gm%'
    and lower(nick) not like 'cm%'
  );

-- UPDATE: só o próprio usuário pode atualizar seus dados
create policy "atualizar proprios dados"
  on public.users for update
  using (auth.uid()::text = id::text);  -- simplificado: comparar IDs

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
