// ============================================================
// Pixel Vanguard Idle — servidor Node.js
// Serve o jogo. As credenciais do Supabase estão
// diretamente no código do cliente (públicas — anon key).
// ============================================================
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const GAME_FILE = path.join(__dirname, 'public', 'pixel-vanguard-idle.html');

// rota principal: entrega o jogo sem modificação
app.get('/', (req, res) => {
  try {
    const html = fs.readFileSync(GAME_FILE, 'utf8');
    res.type('html').send(html);
  } catch (e) {
    res.status(500).send('Erro ao carregar o jogo: ' + e.message);
  }
});

// healthcheck (o Render usa para saber se o serviço está vivo)
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    supabase: true,  // credenciais estão no cliente, sempre disponível
    time: new Date().toISOString(),
  });
});

// arquivos estáticos (imagens, etc), se você adicionar depois
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`\n🎮 Pixel Vanguard Idle rodando em http://localhost:${PORT}`);
  console.log('✅ Supabase configurado diretamente no código do cliente');
  console.log(`📋 Acesse: http://localhost:${PORT}`);
});
