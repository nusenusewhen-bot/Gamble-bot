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
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim().toLowerCase();
  const channelId = message.channel.id;

  // ─── Start dice game ───
  if (content.startsWith('-dicegame')) {
    if (games.has(channelId)) {
      return message.reply('Game already running. Finish or -stopdice first.');
    }

    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('Use: `-dicegame @user`');
    if (opponent.id === message.author.id) return message.reply('Can\'t play yourself');

    games.set(channelId, {
      p1: message.author,
      p2: opponent,
      scores: { [message.author.id]: 0, [opponent.id]: 0 },
      turn: message.author.id,
      round: 0,
      maxRounds: 15
    });

    return message.channel.send(
      `🎲 Dice game started\n` +
      `${message.author} vs ${opponent}\n` +
      `First turn: ${message.author}\n` +
      `Type \`-roll\` on your turn\n` +
      `End with \`-stopdice\``
    );
  }

  // ─── Stop game ───
  if (content === '-stopdice') {
    if (!games.has(channelId)) return;
    const game = games.get(channelId);
    const s1 = game.scores[game.p1.id];
    const s2 = game.scores[game.p2.id];

    let result = `Game ended.\nFinal:\n${game.p1}: **${s1}**\n${game.p2}: **${s2}**\n`;
    if (s1 > s2) result += `**${game.p1} wins**`;
    else if (s2 > s1) result += `**${game.p2} wins**`;
    else result += '**Draw**';

    message.channel.send(result);
    games.delete(channelId);
  }

  // ─── Roll ───
  if (content.startsWith('-roll')) {
    const game = games.get(channelId);
    if (!game) return message.reply('No active game. Start with -dicegame @user');

    if (message.author.id !== game.turn) {
      return message.reply(`Not your turn. Waiting for <@${game.turn}>`);
    }

    let d1 = Math.floor(Math.random() * 6) + 1;
    let d2 = Math.floor(Math.random() * 6) + 1;
    let total = d1 + d2;

    // Very subtle owner edge: ~20% chance to reroll once if total < 6
    if (message.author.id === OWNER_ID && total < 6 && Math.random() < 0.20) {
      d1 = Math.floor(Math.random() * 6) + 1;
      d2 = Math.floor(Math.random() * 6) + 1;
      total = d1 + d2;
    }

    game.scores[message.author.id] += total;
    game.round++;

    let msg = `Round ${game.round} — ${message.author} rolled **${d1} + ${d2} = ${total}**\n`;
    msg += `**Scores:**\n${game.p1}: **${game.scores[game.p1.id]}**\n${game.p2}: **${game.scores[game.p2.id]}**`;

    if (total === 12) msg += '  🔥';
    if (total <= 4)  msg += '  😬';

    await message.channel.send(msg);

    // Switch turn
    game.turn = message.author.id === game.p1.id ? game.p2.id : game.p1.id;

    if (game.round >= game.maxRounds) {
      const s1 = game.scores[game.p1.id];
      const s2 = game.scores[game.p2.id];
      let endMsg = `\n**Game over** (${game.maxRounds} rounds)\nFinal:\n${game.p1}: **${s1}** — ${game.p2}: **${s2}**\n`;
      if (s1 > s2) endMsg += `**${game.p1} wins**`;
      else if (s2 > s1) endMsg += `**${game.p2} wins**`;
      else endMsg += '**Draw**';

      await message.channel.send(endMsg);
      games.delete(channelId);
    } else {
      await message.channel.send(`Next turn: <@${game.turn}> — type \`-roll\``);
    }
  }

  // ─── Coinflip (interactive choose heads/tails) ───
  if (content.startsWith('-coinflip')) {
    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('Usage: `-coinflip @user`');
    if (opponent.id === message.author.id) return message.reply('Cannot flip against yourself');

    await message.channel.send(
      `🪙 **Coinflip challenge**\n` +
      `${message.author} vs ${opponent}\n` +
      `**Choose: Heads or Tails?** (reply in this channel)`
    );

    // Note: full interactive logic would need collectors or separate handler
    // For simplicity right now just send the prompt
    // You can expand later with message collectors if needed
  }
});

client.login(process.env.DISCORD_TOKEN);
