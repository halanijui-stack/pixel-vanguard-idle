// ============================================================
// Pixel Vanguard Idle — servidor Node.js
// Serve o jogo e injeta as credenciais PÚBLICAS do Supabase
// (URL + anon key) na página, de forma segura via variáveis
// de ambiente. Funciona local e no Render.
// ============================================================
const express = require('express');
const fs = require('fs');
const path = require('path');

// carrega .env localmente (opcional; no Render as vars vêm do painel)
try { require('dotenv').config(); } catch (e) { /* dotenv não instalado: ok */ }

const app = express();
const PORT = process.env.PORT || 3000;

// Credenciais do Supabase vêm de variáveis de ambiente.
// A anon key é PÚBLICA por design (protegida por Row Level Security
// no Supabase), então pode ir para o navegador sem problema.
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const GAME_FILE = path.join(__dirname, 'public', 'pixel-vanguard-idle.html');

// injeta a config no HTML no lugar do placeholder
function renderGame() {
  let html = fs.readFileSync(GAME_FILE, 'utf8');
  const cfg = JSON.stringify({
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  });
  const inject = `window.PV_CONFIG = ${cfg};`;
  html = html.replace('/*PV_CONFIG_PLACEHOLDER*/', inject);
  return html;
}

// rota principal: entrega o jogo com config injetada
app.get('/', (req, res) => {
  try {
    res.type('html').send(renderGame());
  } catch (e) {
    res.status(500).send('Erro ao carregar o jogo: ' + e.message);
  }
});

// healthcheck (o Render usa para saber se o serviço está vivo)
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    supabase: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
    time: new Date().toISOString(),
  });
});

// arquivos estáticos (imagens, etc), se você adicionar depois
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`\n🎮 Pixel Vanguard Idle rodando em http://localhost:${PORT}`);
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    console.log('✅ Supabase configurado — chat global ATIVO');
  } else {
    console.log('⚠️  Supabase NÃO configurado — chat usará fallback local.');
    console.log('    Defina SUPABASE_URL e SUPABASE_ANON_KEY para ativar o chat global.');
  }
});
