const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const OWNER_ID = '1298640383688970293';

// Active games: channelId → game data
const games = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag} - rigged dice mode`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim().toLowerCase();
  const channelId = message.channel.id;

  // ─── Start game ───
  if (content.startsWith('-dicegame')) {
    if (games.has(channelId)) {
      return message.reply('Game already running here. Finish or -stopdice first.');
    }

    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('Use: `-dicegame @user`');
    if (opponent.id === message.author.id) return message.reply('Can\'t play yourself bro');

    games.set(channelId, {
      p1: message.author,                // you or whoever starts
      p2: opponent,
      scores: { [message.author.id]: 0, [opponent.id]: 0 },
      turn: message.author.id,           // starter first
      round: 0,
      maxRounds: 15,
      forceGoodForOpponentNext: false    // flag for -roll pls
    });

    return message.channel.send(
      `🎲 Dice battle started\n` +
      `${message.author} vs ${opponent}\n` +
      `First turn: ${message.author}\n` +
      `Type \`-roll\` when it's your turn\n` +
      `End with \`-stopdice\``
    );
  }

  // ─── Stop game ───
  if (content === '-stopdice') {
    if (!games.has(channelId)) return;
    const game = games.get(channelId);
    const s1 = game.scores[game.p1.id];
    const s2 = game.scores[game.p2.id];

    let result = `Game stopped.\nFinal:\n${game.p1}: **${s1}**\n${game.p2}: **${s2}**\n`;
    if (s1 > s2) result += `**${game.p1} wins**`;
    else if (s2 > s1) result += `**${game.p2} wins**`;
    else result += '**Draw**';

    message.channel.send(result);
    games.delete(channelId);
  }

  // ─── Roll ───
  if (content.startsWith('-roll')) {
    const game = games.get(channelId);
    if (!game) return message.reply('No game running. Start with -dicegame @user');

    if (message.author.id !== game.turn) {
      return message.reply(`Wait your turn! It's <@${game.turn}>'s go.`);
    }

    const isOwner = message.author.id === OWNER_ID;
    const plsRequested = content.includes('pls') || content.includes('please');

    let d1, d2, total;

    if (isOwner) {
      // YOU → almost always good
      if (Math.random() < 0.90) {          // 90% chance excellent
        total = Math.floor(Math.random() * 4) + 9;  // 9–12
      } else if (Math.random() < 0.97) {
        total = Math.floor(Math.random() * 3) + 7;  // 7–9
      } else {
        total = Math.floor(Math.random() * 5) + 3;  // rare bad
      }

      d1 = Math.floor(Math.random() * 4) + 3;   // bias dice to look decent
      d2 = total - d1;
      if (d2 < 1 || d2 > 6) d2 = Math.floor(Math.random() * 3) + 4;
    } else {
      // OPPONENT
      if (game.forceGoodForOpponentNext || plsRequested) {
        // You activated good roll for him
        total = Math.floor(Math.random() * 4) + 9;  // 9–12
        game.forceGoodForOpponentNext = false;
        message.channel.send("Alright, giving him a solid one this time...");
      } else {
        // Normal → mostly trash
        if (Math.random() < 0.80) {
          total = Math.floor(Math.random() * 6) + 2;  // 2–7
        } else if (Math.random() < 0.95) {
          total = Math.floor(Math.random() * 3) + 6;  // 6–8
        } else {
          total = Math.floor(Math.random() * 4) + 9;  // very rare good
        }
      }

      d1 = Math.floor(Math.random() * 6) + 1;
      d2 = total - d1;
      if (d2 < 1) d2 = 1;
      if (d2 > 6) d2 = 6;
    }

    // Final safety
    if (d1 + d2 !== total) {
      d1 = Math.floor(total / 2);
      d2 = total - d1;
    }

    // Add points
    game.scores[message.author.id] += total;
    game.round++;

    // Build message
    let msg = `Round ${game.round} — ${message.author} rolled **${d1} + ${d2} = ${total}**\n`;
    msg += `**Scores:**\n${game.p1}: **${game.scores[game.p1.id]}** pts\n${game.p2}: **${game.scores[game.p2.id]}** pts`;

    if (total >= 10) msg += '  🔥';
    if (total <= 5)  msg += '  💀';

    await message.channel.send(msg);

    // Switch turn
    game.turn = (message.author.id === game.p1.id) ? game.p2.id : game.p1.id;

    // If opponent just rolled badly and it's your turn next → you can decide to say pls next time
    // Auto-end check
    if (game.round >= game.maxRounds) {
      const s1 = game.scores[game.p1.id];
      const s2 = game.scores[game.p2.id];
      let end = `\n**Game over** (${game.maxRounds} rounds)\nFinal:\n${game.p1}: **${s1}** — ${game.p2}: **${s2}**\n`;
      if (s1 > s2) end += `**${game.p1} wins**`;
      else if (s2 > s1) end += `**${game.p2} wins**`;
      else end += '**Draw**';

      await message.channel.send(end);
      games.delete(channelId);
    } else {
      await message.channel.send(`Next turn: <@${game.turn}>  —  type \`-roll\``);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
