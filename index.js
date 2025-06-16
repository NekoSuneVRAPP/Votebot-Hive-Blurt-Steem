const { checkAndVoteOnPosts } = require('./modules/UpVoteCheck')
const { monitorTransactions } = require('./modules/Donations')
const { getSelectedDelegatorsHP, hasDelegated } = require('./modules/Deleee')

const {
  blurt,
  dsteem,
  dhive,
} = require('./depends')


// Configure clients
dhive.api.setOptions({ url: "https://api.hive.blog" });

dsteem.api.setOptions({ url: "https://api.steemit.com" });

blurt.api.setOptions({ url: "https://rpc.blurt.world" });

// Main function to handle bot operations
async function runBot() {
  console.log("Bot is starting...");

  // Monitor incoming transactions on Hive, Steem, and Blurt
  //monitorTransactions("hive");
  //monitorTransactions('steem');
  //monitorTransactions('blurt');

  // Upvote posts on Hive, Steem, and Blurt
  await checkAndVoteOnPosts("hive", dhive);
  await checkAndVoteOnPosts('steem', dsteem);
  await checkAndVoteOnPosts('blurt', blurt);

  console.log("Bot has finished voting.");
}

// Run bot every hour
setInterval(runBot, 30 * 1000);