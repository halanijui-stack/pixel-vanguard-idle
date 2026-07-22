# 🎮 Pixel Vanguard Idle — Chat Global com Supabase Realtime

Servidor Node.js que serve o jogo e liga o **chat global em tempo real** usando **Supabase Realtime**. Roda de graça localmente e no **Render**.

---

## Como funciona

```
Navegador (jogo)  ──WebSocket──►  Supabase Realtime  ◄──  outros jogadores
        ▲                              (Postgres + Realtime)
        │ HTML com config injetada
   Servidor Node (Render)
```

- O **Supabase** guarda as mensagens (tabela `messages`) e transmite cada nova mensagem em tempo real para todos os jogadores conectados.
- O **servidor Node** só serve o HTML do jogo e injeta as credenciais públicas do Supabase na página. Ele **não** fica no meio do chat — o navegador fala direto com o Supabase.
- A `anon key` do Supabase é **pública por design** e protegida por **Row Level Security (RLS)**.

---

## Passo 1 — Criar o projeto no Supabase (grátis)

1. Vá em https://supabase.com e crie uma conta / novo projeto (plano free).
2. Espere o projeto terminar de provisionar (~2 min).
3. Abra **SQL Editor** (menu lateral), cole todo o conteúdo de [`supabase-setup.sql`](./supabase-setup.sql) e clique em **Run**.
   - Isso cria a tabela `messages`, ativa o Realtime e configura a segurança (RLS).
4. Vá em **Project Settings → API** (ou **Data API**) e copie:
   - **Project URL** → será seu `SUPABASE_URL`
   - **anon public** key → será seu `SUPABASE_ANON_KEY`

---

## Passo 2 — Rodar localmente

Requer Node.js 18+ instalado.

```bash
# 1. entre na pasta
cd pixel-vanguard-server

# 2. instale as dependências
npm install

# 3. crie o arquivo .env a partir do exemplo
cp .env.example .env
#    depois edite o .env e cole seu SUPABASE_URL e SUPABASE_ANON_KEY

# 4. inicie o servidor
npm start
```

Abra **http://localhost:3000** no navegador. Para testar o chat de verdade, abra em **duas abas** (ou dois navegadores) com nicks diferentes e mande mensagens — elas aparecem instantaneamente nas duas.

> Sem o `.env` configurado, o jogo ainda roda, mas o chat cai no modo local (só a sua aba). O console do servidor avisa qual modo está ativo.

---

## Passo 3 — Deploy no Render (grátis)

1. Suba esta pasta para um repositório no **GitHub**.
2. Em https://render.com → **New → Web Service** → conecte o repositório.
3. Configure:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Em **Environment → Environment Variables**, adicione:
   - `SUPABASE_URL` = sua Project URL
   - `SUPABASE_ANON_KEY` = sua anon public key
5. Clique em **Create Web Service**. Em ~1-2 min o jogo estará no ar numa URL tipo `https://pixel-vanguard-idle.onrender.com`.

> **Alternativa (Blueprint):** este repo tem um [`render.yaml`](./render.yaml). No Render, use **New → Blueprint**, aponte para o repo e ele cria o serviço automaticamente (você só preenche as duas variáveis de ambiente).

### Observação sobre o plano free do Render
O serviço "dorme" após ~15 min sem acesso e leva alguns segundos para acordar no primeiro acesso seguinte. Isso não afeta o chat depois que carrega. (O Supabase free não dorme.)

---

## Estrutura dos arquivos

```
pixel-vanguard-server/
├── server.js              # servidor Express (injeta config, serve o jogo)
├── package.json           # dependências
├── render.yaml            # blueprint do Render (opcional)
├── supabase-setup.sql     # SQL para criar a tabela e a segurança
├── .env.example           # modelo das variáveis de ambiente
├── .gitignore
└── public/
    └── pixel-vanguard-idle.html   # o jogo
```

---

## Segurança (o que já está configurado)

- **RLS ativado:** com a anon key, dá para **ler** o chat e **inserir** mensagens, mas **não** dá para editar nem apagar mensagens de outros.
- **Limites no INSERT:** nick de 2–24 caracteres e mensagem de até 200 — validados no banco.
- **Cooldown de 20s** por mensagem no cliente (evita spam).

Para produção séria, você pode ainda: adicionar um cron de limpeza (já comentado no SQL), ativar Auth do Supabase, ou moderação de palavras.

---

## Como o jogo escolhe o modo do chat

O jogo tenta, nesta ordem:
1. **Supabase Realtime** — se `window.PV_CONFIG` tiver URL + anon key (injetadas pelo servidor). ✅ chat global real
2. **window.storage** — ambiente Claude (compartilhado).
3. **BroadcastChannel** — só abas do mesmo dispositivo.

Ou seja: o mesmo arquivo do jogo funciona em qualquer lugar, e "liga" o chat global automaticamente quando as credenciais existem.
