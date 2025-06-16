const { Donation } = require("./DB/db");
const {
  blurt,
  dsteem,
  dhive,
  moment,
  fs, 
  config
} = require('../depends')

dhive.api.setOptions({ url: "https://api.hive.blog" });
const hivePrivateKey = dhive.auth.toWif(config.hive.username, config.hive.posting, "posting");
const hiveActiveKey = dhive.auth.toWif(config.hive.username, config.hive.active, "active");

dsteem.api.setOptions({ url: "https://api.steemit.com" });
const steemPrivateKey = dsteem.auth.toWif(config.steem.username, config.steem.posting, "posting");

blurt.api.setOptions({ url: "https://rpc.blurt.world" });
const blurtPrivateKey = blurt.auth.toWif(config.blurt.username, config.blurt.posting, "posting");

const BOOSTED_USERS_FILE = "boostedUsers.json"; // File to store boosted users

// Load boosted users from file or initialize as empty object
let boostedUsers = {};
if (fs.existsSync(BOOSTED_USERS_FILE)) {
  const data = fs.readFileSync(BOOSTED_USERS_FILE, "utf8");
  boostedUsers = JSON.parse(data);
}

// Save boosted users to file
function saveBoostedUsers() {
  fs.writeFileSync(BOOSTED_USERS_FILE, JSON.stringify(boostedUsers, null, 2));
}

const BOOST_DURATION_DAYS = 30; // Boost duration in days

// Function to handle donations and caching
// Function to handle donations and caching
async function handleDonation(platform, sender, amount, memo) {
  const memoParts = memo.split(" ");
  if (memoParts[0] === "BOOST" && memoParts.length === 2) {
    const username = memoParts[1];
    let type = "";

    if (platform === "hive" && amount === 5) {
      type = "HIVE";
      await dhive.broadcast.transferToVesting(
        hiveActiveKey,
        {
          from: HIVE_USERNAME,
          to: username,
          amount: `${amount.toFixed(3)} HIVE`,
        }
      );
    } else if (platform === "steem" && amount === 5) {
      type = "STEEM";
      await dsteem.broadcast.transferToVesting(
        steemPrivateKey,
        {
          from: STEEM_USERNAME,
          to: username,
          amount: `${amount.toFixed(3)} STEEM`,
        }
      );
    } else if (platform === "blurt" && amount === 5) {
      type = "BLURT";
      await blurt.broadcast.transferToVestingAsync(
        blurtPrivateKey,
        {
          from: BLURT_USERNAME,
          to: username,
          amount: `${amount.toFixed(3)} BLURT`,
        }
      );
    }

    if (type) {
      // Record the donation (pseudo-code)
      // Assuming you have a Donation model set up, this is where you'd record it
      await Donation.create({
        username,
        platform,
        amount,
        type,
      });

      // Apply boost for HBD/SBD donations
      if (platform === "hive" && memo.includes("HBD")) {
        boostedUsers[username] = moment()
          .add(BOOST_DURATION_DAYS, "days")
          .toISOString();
      } else if (platform === "steem" && memo.includes("SBD")) {
        boostedUsers[username] = moment()
          .add(BOOST_DURATION_DAYS, "days")
          .toISOString();
      }

      saveBoostedUsers(); // Save updated boosted users to file
      console.log(`@${username} has received a boost on ${platform}`);
    }
  }
}

// Function to monitor and handle incoming transactions
async function monitorTransactions(platform) {
  let client;
  // Create the client based on the platform
  switch (platform) {
    case 'hive':
      client = dhive;
      client.api.setOptions({ url: "https://api.hive.blog" });
      break;
    case 'steem':
      client = dsteem;
      client.api.setOptions({ url: "https://api.steemit.com" });
      break;
    case 'blurt':
      client = blurt;
      client.api.setOptions({ url: "https://rpc.blurt.world" });
      break;
    default:
      throw new Error("Unsupported platform");
  }

  // Monitor transactions for incoming transfers
  client.api.streamOperations((err, operation) => {
    if (err) {
      console.error("Error streaming operations:", err);
      return;
    }

    const [opType, opData] = operation;
    if (
      opType === "transfer" &&
      opData.to ===
        (platform === "hive"
          ? config.hive.username
          : platform === "steem"
          ? config.steem.username
          : config.blurt.username)
    ) {
      const amount = parseFloat(opData.amount.split(" ")[0]);
      const memo = opData.memo;
      handleDonation(platform, opData.from, amount, memo);
    }
  });
}

module.exports = {
  handleDonation,
  monitorTransactions
};
