const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const OWNER_ID = '1298640383688970293';

// Simple in-memory points (resets on bot restart — for Railway free tier it's fine)
const points = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.toLowerCase().trim();

  if (content === '-roll') {
    let total, d1, d2;

    if (message.author.id === OWNER_ID) {
      // Owner: biased toward higher rolls (realistic "hot hand")
      // Weights: very low chance of trash, high chance of 8+
      const weighted = weightedRandom([
        { value: 2,  weight: 1 },
        { value: 3,  weight: 2 },
        { value: 4,  weight: 4 },
        { value: 5,  weight: 8 },
        { value: 6,  weight: 12 },
        { value: 7,  weight: 15 },
        { value: 8,  weight: 18 },
        { value: 9,  weight: 16 },
        { value: 10, weight: 14 },
        { value: 11, weight: 10 },
        { value: 12, weight: 8  }
      ]);
      total = weighted;
      d1 = Math.floor(Math.random() * 6) + 1;
      d2 = total - d1;
      if (d2 < 1 || d2 > 6) d2 = 6; // keep it valid-looking
    } else {
      // Normal users: standard-ish dice (slight house edge, but looks fair)
      d1 = Math.floor(Math.random() * 6) + 1;
      d2 = Math.floor(Math.random() * 6) + 1;
      total = d1 + d2;
    }

    // Points: total + small bonus (owner gets ~30-50% more on average)
    const earned = total + (message.author.id === OWNER_ID ? Math.floor(Math.random() * 3) + 2 : 0);
    const userPoints = (points.get(message.author.id) || 0) + earned;
    points.set(message.author.id, userPoints);

    const msg = `🎲 ${message.author} rolled **${d1} + ${d2} = ${total}**\nYou earned **${earned}** points\nYour total: **${userPoints}** points`;

    await message.channel.send(msg);
  }

  // Optional: check points
  if (content === '-points') {
    const userPoints = points.get(message.author.id) || 0;
    await message.channel.send(`${message.author}, you have **${userPoints}** points.`);
  }

  // Keep your coinflip if you want — or remove it
  if (content.startsWith('-coinflip')) {
    const mention = message.mentions.users.first();
    if (!mention) return message.reply('Mention someone: `-coinflip @user`');

    let winner;
    if (message.author.id === OWNER_ID || mention.id === OWNER_ID) {
      winner = message.author.id === OWNER_ID ? message.author : mention;
    } else {
      winner = Math.random() < 0.5 ? message.author : mention;
    }

    await message.channel.send(`🪙 Coinflip: **${winner} wins!**`);
  }
});

// Helper: weighted random for owner rolls
function weightedRandom(options) {
  let sum = 0;
  options.forEach(opt => sum += opt.weight);
  let r = Math.random() * sum;
  for (const opt of options) {
    r -= opt.weight;
    if (r <= 0) return opt.value;
  }
  return options[options.length - 1].value;
}

client.login(process.env.DISCORD_TOKEN);
