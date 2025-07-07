require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');

let config;
try {
  const configPath = path.join(__dirname, 'config.json');
  const configFile = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configFile);

  if (!config.generalMessage) {
    throw new Error('generalMessage is required in config.json');
  }

  config.personalizedMessages = config.personalizedMessages || {};
  config.additionalUsers = config.additionalUsers || [];

  const allUserIds = [
    ...new Set([
      ...Object.keys(config.personalizedMessages || {}),
      ...(config.additionalUsers || [])
    ])
  ];

  if (allUserIds.length === 0) {
    throw new Error('No valid user IDs found in the configuration');
  }

  config.allUserIds = allUserIds;

  console.log('\n📋 Message Configuration:');
  console.log(`📢 General message: "${config.generalMessage}"`);
  console.log(`\n👤 Recipients (${allUserIds.length} total):`);

  const personalUserIds = Object.keys(config.personalizedMessages);
  if (personalUserIds.length > 0) {
    console.log(`\n   Personalized messages (${personalUserIds.length}):`);
    personalUserIds.forEach(userId => {
      console.log(`   - ${userId}: "${config.personalizedMessages[userId]}"`);
    });
  }

  if (config.additionalUsers.length > 0) {
    console.log(`\n   Additional users (${config.additionalUsers.length}):`);
    config.additionalUsers.forEach(userId => {
      console.log(`   - ${userId} (general message only)`);
    });
  }

} catch (error) {
  console.error('\n❌ Error loading configuration:', error.message);
  console.log('\nPlease check your config.json file.');
  process.exit(1);
}

const scheduledDate = new Date(process.env.SCHEDULED_TIME);
if (isNaN(scheduledDate.getTime())) {
  console.error('❌ Invalid date in SCHEDULED_TIME environment variable');
  process.exit(1);
}

console.log(`\n⏰ Message will be sent at: ${scheduledDate}`);
console.log('🔄 Waiting for the scheduled time... (Press Ctrl+C to cancel)');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendMessages = async () => {
  const client = new Client();

  try {
    console.log('\n🔌 Connecting to Discord...');
    await client.login(process.env.TOKEN);
    console.log(`✅ Logged in as ${client.user.tag}`);

    // send messages to all users
    for (const [index, userId] of config.allUserIds.entries()) {
      try {
        const targetUser = await client.users.fetch(userId);
        const isPersonalized = userId in config.personalizedMessages;

        console.log(`\n📨 Sending to ${userId}:`);

        // send general message
        console.log(`   💬 [General] "${config.generalMessage}"`);
        await targetUser.send(config.generalMessage);

        // if user has a personalized message, send it after a delay
        if (isPersonalized) {
          const personalMessage = config.personalizedMessages[userId];
          console.log(`   ⏳ Waiting 10 seconds before sending personalized message...`);
          await delay(10000); // 10 second delay

          console.log(`   ✉️ [Personal] "${personalMessage}"`);
          await targetUser.send(personalMessage);
        }

        // Add delay between users to avoid rate limiting (except after last user)
        if (index < config.allUserIds.length - 1) {
          await delay(5000);
        }

      } catch (error) {
        console.error(`❌ Failed to send to ${userId}:`, error.message);
      }
    }

    console.log('\n✅ All messages sent successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.destroy();
    process.exit(0);
  }
};

const job = schedule.scheduleJob(scheduledDate, sendMessages);

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (job) job.cancel();
  process.exit(0);
});
