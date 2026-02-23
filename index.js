const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const OWNER_ID = '1298640383688970293';

// Active games: channelId → { p1, p2, scores, turn, round }
const games = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim().toLowerCase();
  const channelId = message.channel.id;

  // ─── Start game ───
  if (content.startsWith('-dicegame')) {
    if (games.has(channelId)) {
      return message.reply('A game is already running in this channel. Wait for it to finish or use -stopdice');
    }

    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('Mention someone: `-dicegame @user`');
    if (opponent.id === message.author.id) return message.reply('You can\'t play against yourself...');

    games.set(channelId, {
      p1: message.author,           // starter
      p2: opponent,
      scores: { [message.author.id]: 0, [opponent.id]: 0 },
      turn: message.author.id,      // starter goes first
      round: 0,
      maxRounds: 15
    });

    return message.channel.send(
      `🎲 Dice game started!\n` +
      `${message.author} vs ${opponent}\n` +
      `First to roll: ${message.author}\n` +
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

    let result = `Game ended.\nFinal score:\n${game.p1}: **${s1}**\n${game.p2}: **${s2}**\n`;
    if (s1 > s2) result += `**${game.p1} wins!**`;
    else if (s2 > s1) result += `**${game.p2} wins!**`;
    else result += '**Draw**';

    message.channel.send(result);
    games.delete(channelId);
  }

  // ─── Roll ───
  if (content === '-roll') {
    const game = games.get(channelId);
    if (!game) return message.reply('No active dice game here. Start one with -dicegame @user');

    if (message.author.id !== game.turn) {
      return message.reply(`Not your turn! Waiting for <@${game.turn}>`);
    }

    // Roll logic
    let d1 = Math.floor(Math.random() * 6) + 1;
    let d2 = Math.floor(Math.random() * 6) + 1;

    // Owner hidden edge: 30% chance to reroll the lowest die once
    if (message.author.id === OWNER_ID && Math.random() < 0.30) {
      if (d1 <= d2) {
        d1 = Math.floor(Math.random() * 6) + 1;
      } else {
        d2 = Math.floor(Math.random() * 6) + 1;
      }
    }

    const total = d1 + d2;

    // Add to score
    game.scores[message.author.id] = (game.scores[message.author.id] || 0) + total;
    game.round++;

    // Show result
    let msg = `**Round ${game.round}** — ${message.author} rolled **${d1} + ${d2} = ${total}**\n`;
    msg += `**Scores:**\n${game.p1}: **${game.scores[game.p1.id]}**\n${game.p2}: **${game.scores[game.p2.id]}**`;

    if (total === 12) msg += '  🔥';
    if (total <= 4)  msg += '  😬';

    await message.channel.send(msg);

    // Switch turn
    game.turn = message.author.id === game.p1.id ? game.p2.id : game.p1.id;

    // Check end conditions
    if (game.round >= game.maxRounds) {
      const s1 = game.scores[game.p1.id];
      const s2 = game.scores[game.p2.id];
      let endMsg = `\n**Game over** (${game.maxRounds} rounds)\nFinal:\n${game.p1}: **${s1}** — ${game.p2}: **${s2}**\n`;
      if (s1 > s2) endMsg += `**${game.p1} wins!**`;
      else if (s2 > s1) endMsg += `**${game.p2} wins!**`;
      else endMsg += '**Draw**';

      await message.channel.send(endMsg);
      games.delete(channelId);
    } else {
      await message.channel.send(`Next turn: <@${game.turn}> — type \`-roll\``);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
