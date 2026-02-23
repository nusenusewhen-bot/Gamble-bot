const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const OWNER_ID = '1298640383688970293';

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag} (Rigged edition)`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase().trim();

  // ──────────────── ROLL ────────────────
  if (content === '-roll') {
    if (message.author.id === OWNER_ID) {
      // Owner always gets god rolls (10–12)
      const possibilities = [10, 11, 11, 12, 12, 12];
      const total = possibilities[Math.floor(Math.random() * possibilities.length)];
      const d1 = Math.min(6, Math.max(4, total - 6)); // fake nice looking dice
      const d2 = total - d1;

      const embed = new EmbedBuilder()
        .setColor(0xffaa00)
        .setTitle('🎲 GOD OWNER ROLL')
        .setDescription(`${message.author} rolled...\n**${d1}** + **${d2}** = **${total}** 🔥👑`)
        .setFooter({ text: 'Rigged for the house' });

      return message.channel.send({ embeds: [embed] });
    } else {
      // Normal users → mostly trash
      const total = weightedRandom([
        { value: 2,  weight: 8  },  // very common low
        { value: 3,  weight: 12 },
        { value: 4,  weight: 15 },
        { value: 5,  weight: 12 },
        { value: 6,  weight: 8  },
        { value: 7,  weight: 5  },
        { value: 8,  weight: 3  },
        { value: 9,  weight: 2  },
        { value: 10, weight: 1  },
        { value: 11, weight: 0.5}
      ]);

      const emoji = total <= 6 ? '😭' : total <= 9 ? '😐' : '🥳 (rare af)';

      await message.channel.send(
        `🎲 ${message.author} rolled **${total}** ${emoji}`
      );
    }
  }

  // ──────────────── COINFLIP CHALLENGE ────────────────
  if (content.startsWith('-coinflip')) {
    const mention = message.mentions.users.first();

    if (!mention) {
      return message.reply('Mention someone → `-coinflip @user`');
    }

    if (mention.id === OWNER_ID || message.author.id === OWNER_ID) {
      // Owner is always involved → owner wins
      const winner = message.author.id === OWNER_ID ? message.author : mention;
      await message.channel.send(
        `🪙 **Coinflip** → **${winner} wins** (house always collects 👑)`
      );
    } else {
      // normal vs normal → 50/50
      const winner = Math.random() < 0.5 ? message.author : mention;
      await message.channel.send(`🪙 **${winner} wins the coinflip!**`);
    }
  }
});

// Very simple weighted random helper
function weightedRandom(options) {
  let sum = 0;
  for (const opt of options) sum += opt.weight;

  let r = Math.random() * sum;
  for (const opt of options) {
    r -= opt.weight;
    if (r <= 0) return opt.value;
  }
  return options[options.length - 1].value; // fallback
}

client.login(process.env.DISCORD_TOKEN);
