-- ============================================================
-- Criar usuário ADM-SOUL no Supabase
-- Cole isto no SQL Editor do Supabase e clique em RUN
-- 
-- Hash bcrypt da senha "97779" (gerado com bcryptjs rounds=4):
-- $2a$04$INSIRA_SEU_HASH_AQUI
-- 
-- OU use este comando para gerar o hash localmente:
-- node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('97779', 4, (e,h)=>console.log(h));"
-- ============================================================

-- Inserir usuário ADM-SOUL (SUBSTITUA O HASH ABAIXO COM O SEU)
INSERT INTO public.users (nick, password, game_data)
VALUES (
  'ADM-SOUL',
  -- IMPORTANTE: substitua isso pelo hash bcrypt real da senha "97779"
  -- Gere em: https://bcrypt-generator.com/ (rounds: 4)
  -- Ou localmente: node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('97779', 4, (e,h)=>console.log(h));"
  '$2a$04$SUA_SENHA_HASH_AQUI',
  
  -- Dados de jogo do admin (JSON)
  '{"nick":"ADM-SOUL","lang":"pt","k":{"lvl":9999,"hp":99999,"mp":99999,"xp":9999999999,"atk":9999,"def":9999,"spd":9999},"gold":9999999999,"vip":999999,"stage":999,"bestStage":999,"inv":[],"eq":{"weapon":null,"armor":null,"shield":null,"amulet":null,"ring":null,"bracelet":null,"belt":null},"pets":[],"activePetUid":null,"petHp":99999,"pots":{"hp":99999,"mp":99999},"tickets":99999,"autopot":{"hpOn":true,"hpPct":40,"mpOn":true,"mpPct":20},"listings":[],"boosters":{"exp":9999999999,"drop":9999999999},"mastery":9999,"talents":{},"abilCd":{"corte":0,"ira":0,"esquiva":0},"abilAuto":{"corte":false,"ira":false,"esquiva":false},"uidSeq":10000}'
)
ON CONFLICT (nick) DO UPDATE SET
  password = EXCLUDED.password,
  game_data = EXCLUDED.game_data,
  updated_at = now();

-- Verificar se foi criado
SELECT id, nick, created_at, updated_at FROM public.users WHERE nick='ADM-SOUL';
