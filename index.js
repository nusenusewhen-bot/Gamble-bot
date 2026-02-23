const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const OWNER_ID = '1298640383688970293';

// Active dice games: channelId → game data
const games = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag} — rigged edition`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim().toLowerCase();
  const channelId = message.channel.id;

  // ─── DICE GAME ───
  if (content.startsWith('-dicegame')) {
    if (games.has(channelId)) {
      return message.reply('There is already a game running here. Finish it or use -stopdice');
    }

    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('Usage: `-dicegame @user`');
    if (opponent.id === message.author.id) return message.reply('Cannot play against yourself');

    games.set(channelId, {
      p1: message.author,
      p2: opponent,
      scores: { [message.author.id]: 0, [opponent.id]: 0 },
      turn: message.author.id,
      round: 0,
      maxRounds: 15,
      forceGoodOpponentNext: false
    });

    return message.channel.send(
      `🎲 Dice game started\n` +
      `${message.author} vs ${opponent}\n` +
      `First turn: ${message.author}\n` +
      `Type \`-roll\` on your turn\n` +
      `End with \`-stopdice\``
    );
  }

  if (content === '-stopdice') {
    if (!games.has(channelId)) return;
    const game = games.get(channelId);
    const s1 = game.scores[game.p1.id];
    const s2 = game.scores[game.p2.id];

    let result = `Game ended.\nFinal score:\n${game.p1}: **${s1}**\n${game.p2}: **${s2}**\n`;
    if (s1 > s2) result += `**${game.p1} wins**`;
    else if (s2 > s1) result += `**${game.p2} wins**`;
    else result += '**Draw**';

    message.channel.send(result);
    games.delete(channelId);
  }

  // ─── DICE ROLL ───
  if (content.startsWith('-roll')) {
    const game = games.get(channelId);
    if (!game) return message.reply('No active game in this channel. Start with -dicegame @user');

    if (message.author.id !== game.turn) {
      return message.reply(`Not your turn. Waiting for <@${game.turn}>`);
    }

    const isOwner = message.author.id === OWNER_ID;
    const plsMode = content.includes('pls') || content.includes('please');

    let d1, d2, total;

    if (isOwner) {
      // Owner → very good rolls almost always
      if (Math.random() < 0.90) {
        total = Math.floor(Math.random() * 4) + 9; // 9–12
      } else if (Math.random() < 0.97) {
        total = Math.floor(Math.random() * 3) + 7; // 7–9
      } else {
        total = Math.floor(Math.random() * 5) + 3; // rare bad
      }

      d1 = Math.floor(Math.random() * 4) + 3;
      d2 = total - d1;
      if (d2 < 1 || d2 > 6) d2 = Math.floor(Math.random() * 3) + 4;
    } else {
      // Opponent
      if (game.forceGoodOpponentNext || plsMode) {
        total = Math.floor(Math.random() * 4) + 9; // 9–12
        game.forceGoodOpponentNext = false;
        if (plsMode) message.channel.send("Okay, giving him a good roll this time...");
      } else {
        // Mostly bad
        if (Math.random() < 0.80) {
          total = Math.floor(Math.random() * 6) + 2; // 2–7
        } else if (Math.random() < 0.95) {
          total = Math.floor(Math.random() * 3) + 6; // 6–8
        } else {
          total = Math.floor(Math.random() * 4) + 9; // rare good
        }
      }

      d1 = Math.floor(Math.random() * 6) + 1;
      d2 = total - d1;
      if (d2 < 1) d2 = 1;
      if (d2 > 6) d2 = 6;
    }

    // Fix if dice don't add up
    if (d1 + d2 !== total) {
      d1 = Math.floor(total / 2);
      d2 = total - d1;
    }

    game.scores[message.author.id] += total;
    game.round++;

    let msg = `Round ${game.round} — ${message.author} rolled **${d1} + ${d2} = ${total}**\n`;
    msg += `**Scores:**\n${game.p1}: **${game.scores[game.p1.id]}**\n${game.p2}: **${game.scores[game.p2.id]}**`;

    if (total >= 10) msg += '  🔥';
    if (total <= 5) msg += '  💀';

    await message.channel.send(msg);

    game.turn = message.author.id === game.p1.id ? game.p2.id : game.p1.id;

    if (game.round >= game.maxRounds) {
      const s1 = game.scores[game.p1.id];
      const s2 = game.scores[game.p2.id];
      let endMsg = `\nGame over (${game.maxRounds} rounds)\nFinal:\n${game.p1}: **${s1}** — ${game.p2}: **${s2}**\n`;
      if (s1 > s2) endMsg += `**${game.p1} wins**`;
      else if (s2 > s1) endMsg += `**${game.p2} wins**`;
      else endMsg += '**Draw**';

      await message.channel.send(endMsg);
      games.delete(channelId);
    } else {
      await message.channel.send(`Next turn: <@${game.turn}> — type \`-roll\``);
    }
  }

  // ─── COINFLIP ───
  if (content.startsWith('-coinflip')) {
    const opponent = message.mentions.users.first();

    if (!opponent) {
      return message.reply('Usage: `-coinflip @user`');
    }

    if (opponent.id === message.author.id) {
      return message.reply('Cannot flip against yourself');
    }

    const isOwner = message.author.id === OWNER_ID;
    const plsMode = content.includes('pls') || content.includes('please');

    let winner;
    const side = Math.random() < 0.5 ? 'Heads' : 'Tails';

    if (isOwner) {
      if (plsMode) {
        winner = opponent;
        await message.channel.send("Mercy flip... okay this time");
      } else {
        winner = message.author;
      }
    } else {
      winner = Math.random() < 0.5 ? message.author : opponent;
    }

    await message.channel.send(
      `🪙 Coinflip: ${message.author} vs ${opponent}\n` +
      `Landed on **${side}**\n` +
      `**Winner → ${winner}** ${winner.id === OWNER_ID ? '👑' : ''}`
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
