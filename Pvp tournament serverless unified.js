// ============================================================
// FUNÇÕES SERVERLESS PARA AUTOMAÇÃO DO PVP TOURNAMENT
// VERSÃO UNIFICADA COM MARKET_POOL
// Use com: Vercel Functions, Netlify Functions, AWS Lambda, Google Cloud Functions, etc.
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================
// FUNCTION 1: GERAR TORNEIO (SEXTA 23H)
// ============================================================

async function generateTournament(){
  console.log('🏆 Gerando novo torneio PVP...');
  
  try {
    // 1. Buscar top 10 jogadores por STAGE (e LEVEL como critério de desempate)
    const {data: top10, error: topError} = await supabase
      .from('users')
      .select('nick, level, stage')
      .order('stage', {ascending: false})
      .order('level', {ascending: false})
      .limit(10);
    
    if(topError || !top10 || top10.length < 2) {
      console.error('Erro ao buscar top 10:', topError);
      return {ok: false, error: topError};
    }
    
    if(top10.length < 10) {
      console.log(`⚠️  Apenas ${top10.length} jogadores no ranking. Usando todos.`);
    }
    
    // 2. Calcular período da semana (segunda a domingo)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    // 3. Buscar ou criar pool de prêmios da semana
    let pool;
    const {data: existingPool, error: checkPoolError} = await supabase
      .from('market_pool')
      .select('*')
      .eq('week_start', weekStartStr)
      .single();
    
    if(checkPoolError && checkPoolError.code === 'PGRST116') {
      // Pool não existe, criar novo (será atualizado automaticamente por trigger)
      const {data: newPool, error: createError} = await supabase
        .from('market_pool')
        .insert([{
          week_start: weekStartStr,
          week_end: weekEndStr,
          gold_burned: 0,
          vip_burned: 0,
          gold_prize_pool: 0,
          vip_prize_pool: 0,
          status: 'active'
        }])
        .select()
        .single();
      
      if(createError) {
        console.error('Erro ao criar pool:', createError);
        return {ok: false, error: createError};
      }
      pool = newPool;
    } else if(checkPoolError) {
      console.error('Erro ao buscar pool:', checkPoolError);
      return {ok: false, error: checkPoolError};
    } else {
      pool = existingPool;
    }
    
    console.log(`Pool encontrado/criado: ${pool.id} (${pool.gold_prize_pool} Gold, ${pool.vip_prize_pool} VIP)`);
    
    // 4. Gerar chaves aleatórias (shuffle array)
    const shuffled = [...top10].sort(() => Math.random() - 0.5);
    const semifinals = [];
    
    for(let i = 0; i < Math.floor(shuffled.length / 2); i++) {
      semifinals.push({
        match_id: generateUUID(),
        player1_nick: shuffled[i * 2].nick,
        player2_nick: shuffled[i * 2 + 1].nick,
        winner_nick: null
      });
    }
    
    // 5. Criar tournament (referenciando market_pool_id)
    const {data: tournament, error: insertError} = await supabase
      .from('pvp_tournament')
      .insert([{
        market_pool_id: pool.id,
        week_start: weekStartStr,
        week_end: weekEndStr,
        participants: top10,
        semifinals,
        status: 'brackets_generated'
      }])
      .select()
      .single();
    
    if(insertError) {
      console.error('Erro ao criar tournament:', insertError);
      return {ok: false, error: insertError};
    }
    
    console.log(`✅ Torneio criado com sucesso! ${semifinals.length} matches agendadas.`);
    return {ok: true, tournament};
    
  } catch(error) {
    console.error('Erro em generateTournament:', error);
    return {ok: false, error: error.message};
  }
}

// ============================================================
// FUNCTION 2: EXECUTAR SEMIFINAIS (SÁBADO 12H)
// ============================================================

async function executeSemifinals(){
  console.log('⚔️  Executando semifinais...');
  
  try {
    // 1. Buscar torneio atual (status: brackets_generated)
    const {data: tournament, error: tourneyError} = await supabase
      .from('pvp_tournament')
      .select('*')
      .eq('status', 'brackets_generated')
      .order('created_at', {ascending: false})
      .limit(1)
      .single();
    
    if(tourneyError || !tournament) {
      console.error('Nenhum torneio para executar:', tourneyError);
      return {ok: false, error: 'No tournament found'};
    }
    
    console.log(`Executando semifinais do torneio: ${tournament.id}`);
    
    // 2. Executar cada semifinal
    const updatedSemifinals = [];
    
    for(const match of tournament.semifinals) {
      console.log(`Batalha: ${match.player1_nick} vs ${match.player2_nick}`);
      
      const result = await simulatePVPBattle(
        match.player1_nick,
        match.player2_nick,
        tournament.id,
        'semifinal',
        match.match_id
      );
      
      if(!result.ok) {
        console.error(`Erro em ${match.match_id}:`, result.error);
        continue;
      }
      
      updatedSemifinals.push({
        ...match,
        winner_nick: result.winner
      });
    }
    
    // 3. Atualizar tournament status
    const {error: updateError} = await supabase
      .from('pvp_tournament')
      .update({
        semifinals: updatedSemifinals,
        status: 'finals_running'
      })
      .eq('id', tournament.id);
    
    if(updateError) {
      console.error('Erro ao atualizar tournament:', updateError);
      return {ok: false, error: updateError};
    }
    
    console.log(`✅ Semifinais concluídas! ${updatedSemifinals.length} vencedores.`);
    return {ok: true, semifinals: updatedSemifinals};
    
  } catch(error) {
    console.error('Erro em executeSemifinals:', error);
    return {ok: false, error: error.message};
  }
}

// ============================================================
// FUNCTION 3: EXECUTAR FINALS E DISTRIBUIR PRÊMIOS (SÁBADO 14H)
// ============================================================

async function executeFinalsAndRewards(){
  console.log('👑 Executando finals e distribuindo prêmios...');
  
  try {
    // 1. Buscar torneio (status: finals_running)
    const {data: tournament, error: tourneyError} = await supabase
      .from('pvp_tournament')
      .select('*, market_pool:market_pool_id(gold_prize_pool, vip_prize_pool)')
      .eq('status', 'finals_running')
      .order('created_at', {ascending: false})
      .limit(1)
      .single();
    
    if(tourneyError || !tournament) {
      console.error('Nenhum torneio para finalizar:', tourneyError);
      return {ok: false, error: 'No tournament found'};
    }
    
    console.log(`Finalizando torneio: ${tournament.id}`);
    
    // 2. Pegar os 2 semifinalistas vencedores
    const semifinalResults = tournament.semifinals.filter(m => m.winner_nick);
    if(semifinalResults.length < 2) {
      console.error('Não há 2 semifinalistas vencedores');
      return {ok: false, error: 'Not enough semifinal winners'};
    }
    
    const finalist1 = semifinalResults[0];
    const finalist2 = semifinalResults[1];
    
    console.log(`Finals: ${finalist1.winner_nick} vs ${finalist2.winner_nick}`);
    
    // 3. Executar final
    const finalResult = await simulatePVPBattle(
      finalist1.winner_nick,
      finalist2.winner_nick,
      tournament.id,
      'final',
      generateUUID()
    );
    
    if(!finalResult.ok) {
      console.error('Erro ao executar final:', finalResult.error);
      return {ok: false, error: finalResult.error};
    }
    
    const firstPlace = finalResult.winner;
    const secondPlace = finalist1.winner_nick === firstPlace ? finalist2.winner_nick : finalist1.winner_nick;
    
    // 4. Executar 3º lugar (semifinalistas perdedores)
    const loser1Nick = finalist1.player1_nick === finalist1.winner_nick ? finalist1.player2_nick : finalist1.player1_nick;
    const loser2Nick = finalist2.player1_nick === finalist2.winner_nick ? finalist2.player2_nick : finalist2.player1_nick;
    
    console.log(`3º lugar: ${loser1Nick} vs ${loser2Nick}`);
    
    const thirdResult = await simulatePVPBattle(
      loser1Nick,
      loser2Nick,
      tournament.id,
      'third_place',
      generateUUID()
    );
    
    const thirdPlace = thirdResult.ok ? thirdResult.winner : 'draw';
    
    // 5. Calcular prêmios (70-20-10 split) usando market_pool
    const poolData = tournament.market_pool || tournament;
    const goldPool = poolData.gold_prize_pool || 0;
    const vipPool = poolData.vip_prize_pool || 0;
    
    const firstGold = Math.floor(goldPool * 0.7);
    const firstVip = Math.floor(vipPool * 0.7);
    
    const secondGold = Math.floor(goldPool * 0.2);
    const secondVip = Math.floor(vipPool * 0.2);
    
    const thirdGold = Math.floor(goldPool * 0.1);
    const thirdVip = Math.floor(vipPool * 0.1);
    
    console.log(`Prêmios - 1º: ${firstGold} Gold/${firstVip} VIP, 2º: ${secondGold} Gold/${secondVip} VIP, 3º: ${thirdGold} Gold/${thirdVip} VIP`);
    
    // 6. Criar records de rewards
    const {error: rewardsError} = await supabase
      .from('pvp_rewards')
      .insert([
        {tournament_id: tournament.id, nick: firstPlace, placement: 'first', gold_reward: firstGold, vip_reward: firstVip},
        {tournament_id: tournament.id, nick: secondPlace, placement: 'second', gold_reward: secondGold, vip_reward: secondVip},
        {tournament_id: tournament.id, nick: thirdPlace, placement: 'third', gold_reward: thirdGold, vip_reward: thirdVip}
      ]);
    
    if(rewardsError) {
      console.error('Erro ao criar rewards:', rewardsError);
    }
    
    // 7. Atualizar tournament com resultados finais
    const finalMatch = {
      match_id: generateUUID(),
      player1_nick: finalist1.winner_nick,
      player2_nick: finalist2.winner_nick,
      winner_nick: firstPlace
    };
    
    const thirdPlaceMatch = {
      match_id: generateUUID(),
      player1_nick: loser1Nick,
      player2_nick: loser2Nick,
      winner_nick: thirdPlace
    };
    
    const {error: finalUpdateError} = await supabase
      .from('pvp_tournament')
      .update({
        final_match: finalMatch,
        third_place_match: thirdPlaceMatch,
        first_place_nick: firstPlace,
        first_place_gold: firstGold,
        first_place_vip: firstVip,
        second_place_nick: secondPlace,
        second_place_gold: secondGold,
        second_place_vip: secondVip,
        third_place_nick: thirdPlace,
        third_place_gold: thirdGold,
        third_place_vip: thirdVip,
        status: 'completed'
      })
      .eq('id', tournament.id);
    
    if(finalUpdateError) {
      console.error('Erro ao finalizar tournament:', finalUpdateError);
      return {ok: false, error: finalUpdateError};
    }
    
    console.log(`✅ Tournament finalizado! Prêmios distribuídos.`);
    console.log(`   1º: ${firstPlace} (${firstGold} Gold, ${firstVip} VIP)`);
    console.log(`   2º: ${secondPlace} (${secondGold} Gold, ${secondVip} VIP)`);
    console.log(`   3º: ${thirdPlace} (${thirdGold} Gold, ${thirdVip} VIP)`);
    
    return {ok: true, tournament: {firstPlace, secondPlace, thirdPlace}};
    
  } catch(error) {
    console.error('Erro em executeFinalsAndRewards:', error);
    return {ok: false, error: error.message};
  }
}

// ============================================================
// HELPER: SIMULAR BATALHA PVP
// ============================================================

async function simulatePVPBattle(player1Nick, player2Nick, tournamentId, round, matchId){
  try {
    // Buscar dados dos jogadores
    const {data: users, error: userError} = await supabase
      .from('users')
      .select('nick, level, player_atk, player_def, player_hp, player_max_hp')
      .in('nick', [player1Nick, player2Nick]);
    
    if(userError || !users || users.length < 2) {
      console.error('Erro ao buscar dados dos jogadores:', userError);
      return {ok: false, error: userError};
    }
    
    const player1Data = users.find(u => u.nick === player1Nick);
    const player2Data = users.find(u => u.nick === player2Nick);
    
    // Simular batalha
    let p1HP = player1Data.player_max_hp || 100;
    let p2HP = player2Data.player_max_hp || 100;
    const battleLog = [];
    let turn = 0;
    const maxTurns = 500;
    
    while(p1HP > 0 && p2HP > 0 && turn < maxTurns) {
      turn++;
      
      const p1Damage = Math.max(1, (player1Data.player_atk || 10) - (player2Data.player_def || 2) + Math.random() * 5);
      const p2Damage = Math.max(1, (player2Data.player_atk || 10) - (player1Data.player_def || 2) + Math.random() * 5);
      
      p2HP -= p1Damage;
      p1HP -= p2Damage;
      
      battleLog.push({
        turn,
        player1_damage: Math.round(p1Damage),
        player2_damage: Math.round(p2Damage),
        p1_hp: Math.max(0, Math.round(p1HP)),
        p2_hp: Math.max(0, Math.round(p2HP))
      });
      
      if(p1HP <= 0 || p2HP <= 0) break;
    }
    
    const winner = p1HP > 0 ? player1Nick : player2Nick;
    const player1TotalDamage = battleLog.reduce((sum, t) => sum + t.player1_damage, 0);
    const player2TotalDamage = battleLog.reduce((sum, t) => sum + t.player2_damage, 0);
    
    // Salvar match
    const {error: insertError} = await supabase
      .from('pvp_matches')
      .insert([{
        tournament_id: tournamentId,
        player1_nick: player1Nick,
        player2_nick: player2Nick,
        player1_data: {level: player1Data.level, atk: player1Data.player_atk, def: player1Data.player_def, hp: player1Data.player_max_hp},
        player2_data: {level: player2Data.level, atk: player2Data.player_atk, def: player2Data.player_def, hp: player2Data.player_max_hp},
        winner_nick: winner,
        battle_log: battleLog,
        player1_damage_dealt: player1TotalDamage,
        player2_damage_dealt: player2TotalDamage,
        player1_turns_survived: battleLog.length,
        player2_turns_survived: battleLog.length,
        round: round
      }]);
    
    if(insertError) {
      console.error('Erro ao salvar match:', insertError);
      return {ok: false, error: insertError};
    }
    
    console.log(`  ${player1Nick}(${player1TotalDamage} dmg) vs ${player2Nick}(${player2TotalDamage} dmg) -> 🏆 ${winner}`);
    
    return {ok: true, winner, battleLog};
    
  } catch(error) {
    console.error('Erro em simulatePVPBattle:', error);
    return {ok: false, error: error.message};
  }
}

// ============================================================
// HELPER: GERAR UUID
// ============================================================

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================
// EXPORTAR FUNÇÕES PARA SERVERLESS
// ============================================================

module.exports = {
  generateTournament,
  executeSemifinals,
  executeFinalsAndRewards
};

// ============================================================
// EXEMPLO DE USO COM VERCEL CRON
// ============================================================

// api/pvp/generate-tournament.js
// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }
//   const result = await generateTournament();
//   return res.status(200).json(result);
// }

// Adicionar em vercel.json:
// {
//   "crons": [{
//     "path": "/api/pvp/generate-tournament",
//     "schedule": "0 23 * * FRI"
//   }, {
//     "path": "/api/pvp/execute-semifinals",
//     "schedule": "0 12 * * SAT"
//   }, {
//     "path": "/api/pvp/execute-finals",
//     "schedule": "0 14 * * SAT"
//   }]
// }