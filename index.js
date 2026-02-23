const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const OWNER_ID = '1298640383688970293';

// Active dice games
const games = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim().toLowerCase();
  const channelId = message.channel.id;

  // ─── DICE GAME ───
  if (content.startsWith('-dicegame')) {
    if (games.has(channelId)) {
      return message.reply('A game is already running here. Finish or use -stopdice');
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
      maxRounds: 15
    });

    return message.channel.send(
      `🎲 Dice game started!\n` +
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

  if (content.startsWith('-roll')) {
    const game = games.get(channelId);
    if (!game) return message.reply('No active game. Start with -dicegame @user');

    if (message.author.id !== game.turn) {
      return message.reply(`Not your turn! Waiting for <@${game.turn}>`);
    }

    let d1 = Math.floor(Math.random() * 6) + 1;
    let d2 = Math.floor(Math.random() * 6) + 1;
    const total = d1 + d2;

    game.scores[message.author.id] += total;
    game.round++;

    let msg = `Round ${game.round} — ${message.author} rolled **${d1} + ${d2} = ${total}**\n`;
    msg += `**Scores:**\n${game.p1}: **${game.scores[game.p1.id]}**\n${game.p2}: **${game.scores[game.p2.id]}**`;

    if (total === 12) msg += '  🔥';
    if (total <= 4) msg += '  😬';

    await message.channel.send(msg);

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
    return;
  }

  // ─── RIGGED INTERACTIVE COINFLIP ───
  if (content.startsWith('-coinflip')) {
    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('Usage: `-coinflip @user`');
    if (opponent.id === message.author.id) return message.reply('Cannot flip against yourself');

    await message.channel.send(
      `🪙 **Coinflip challenge**\n` +
      `${message.author} vs ${opponent}\n` +
      `Reply with **heads**, **tails**, or **dudd** in this channel (60 seconds)`
    );

    const filter = (m) =>
      m.author.id === message.author.id &&
      m.channel.id === channelId &&
      !m.author.bot;

    const collector = message.channel.createMessageCollector({
      filter,
      max: 1,
      time: 60000,
    });

    collector.on('collect', async (reply) => {
      const choice = reply.content.toLowerCase().trim();

      const landed = Math.random() < 0.5 ? 'Heads' : 'Tails';

      let winner;
      let extra = '';

      if (choice.includes('dudd') || choice.includes('dud') || choice.includes('nah') || choice.includes('nope')) {
        winner = opponent;
        extra = `You chose mercy (${choice}) → **${opponent} wins**`;
      } else {
        winner = message.author;
        if (choice.includes('heads') || choice.includes('tails')) {
          extra = `**${landed}** — You win! 👑`;
        } else {
          extra = `Invalid choice → you still win 👑`;
        }
      }

      await reply.reply(
        `Coin landed on **${landed}**\n` +
        `**Winner: ${winner}**\n${extra}`
      );

      collector.stop();
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        await message.channel.send(
          `No reply in time → **${message.author} wins** by default 👑`
        );
      }
    });
    return;
  }
});

client.login(process.env.DISCORD_TOKEN);
