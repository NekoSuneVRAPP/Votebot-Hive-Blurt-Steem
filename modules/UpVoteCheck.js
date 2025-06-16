// Required modules and environment setup
const { Upvote } = require("./DB/db");
const { blurt, dsteem, dhive, moment, fs, config } = require("../depends");

const { syncDelegations, hasDelegated } = require("./Deleee");

// API Configuration
dhive.api.setOptions({ url: "https://api.hive.blog" });
const hivePrivateKey = dhive.auth.toWif(
  config.hive.username,
  config.hive.posting,
  "posting"
);
const hiveActiveKey = dhive.auth.toWif(
  config.hive.username,
  config.hive.active,
  "active"
);

dsteem.api.setOptions({ url: "https://api.steemit.com" });
const steemPrivateKey = dsteem.auth.toWif(
  config.steem.username,
  config.steem.posting,
  "posting"
);

blurt.api.setOptions({ url: "https://rpc.blurt.world" });
const blurtPrivateKey = blurt.auth.toWif(
  config.blurt.username,
  config.blurt.posting,
  "posting"
);

// File to store boosted users
const BOOSTED_USERS_FILE = "boostedUsers.json";
let boostedUsers = {};

// Load boosted users from file or initialize as empty object
if (fs.existsSync(BOOSTED_USERS_FILE)) {
  const data = fs.readFileSync(BOOSTED_USERS_FILE, "utf8");
  boostedUsers = JSON.parse(data);
}

// Save boosted users to file
function saveBoostedUsers() {
  fs.writeFileSync(BOOSTED_USERS_FILE, JSON.stringify(boostedUsers, null, 2));
}

// Check if a user has a valid boost
function hasBoost(username) {
  if (boostedUsers[username]) {
    const expiration = moment(boostedUsers[username]);
    if (moment().isBefore(expiration)) {
      return true;
    } else {
      delete boostedUsers[username]; // Remove expired boost
      saveBoostedUsers(); // Save updated boosted users to file
    }
  }
  return false;
}

// Constants for upvote percentages
const BASE_UPVOTE_PERCENT = 3000; // 30% base upvote
const DELEGATION_BONUS_PERCENT = 1500; // 15% bonus for delegation
const BOOST_BONUS_PERCENT = 8000; // 80% upvote boost for 1 month with HBD/SBD donation

// Function to remove the last two characters from a string
function removeLastTwoCharacters(input) {
  if (typeof input === "string" && input.length > 2) {
    return input.slice(0, -2); // Removes the last two characters
  }
  return input; // Return input as-is if it is not a string or too short
}

// Check if a post has been upvoted before
async function isPostUpvoted(username, posturl, platform) {
  try {
    const upvote = await Upvote.findOne({
      where: { username, posturl, platform }
    });
    return !!upvote;
  } catch (error) {
    console.error(`Error checking upvote status: ${error}`);
    return false;
  }
}

// Cache upvote data
async function cacheUpvote(username, posturl, platform, upvotePercent) {
  try {
    await Upvote.create({
      username,
      posturl,
      platform,
      upvotePercent
    });
  } catch (error) {
    console.error(`Error caching upvote data: ${error}`);
  }
}

// Delay utility function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry operation with retries and delay
async function retryOperation(fn, retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      await fn();
      return; // Success, exit function
    } catch (error) {
      if (i < retries - 1) {
        console.error(
          `Retrying operation (${i + 1}/${retries}) due to error: ${error}`
        );
        await delay(delayMs); // Wait before retrying
      } else {
        console.error(`Operation failed after ${retries} retries: ${error}`);
        throw error; // Re-throw error after final retry
      }
    }
  }
}

/// Upvote and comment on a post
async function upvoteAndCommentOnPost(platform, client, author, permlink) {
  try {
    let content = "";
    let tags = [];

    // Fetch the post content
    let post;
    if (platform === "hive") {
      post = await client.api.getContentAsync(author, permlink);
      content = post.body;
      tags = post.json_metadata.tags || [];
    } else if (platform === "steem") {
      post = await client.api.getContentAsync(author, permlink);
      content = post.body;
      tags = post.json_metadata.tags || [];
    } else if (platform === "blurt") {
      post = await client.api.getContentAsync(author, permlink);
      content = post.body;
      tags = post.json_metadata.tags || [];
    }

    // Sync delegations
    await syncDelegations(platform, author);

    if (content.length > 100) {
      console.log(
        `Processing post by @${author} on ${platform} with permlink ${permlink}`
      );
      let upvotePercent = BASE_UPVOTE_PERCENT;

      // Check if the author has a boost
      if (hasBoost(author)) {
        console.log(
          `@${author} has an active boost. Increasing upvote percentage.`
        );
        upvotePercent = BOOST_BONUS_PERCENT;
      } else {
        // Check for delegation from the database
        const hasDelegated1 = await hasDelegated(
          platform,
          author,
          platform === "hive"
          ? config.hive.username
          : platform === "steem"
          ? config.steem.username
          : config.blurt.username,
        );

        if (hasDelegated1) {
          console.log(
            `@${author} has delegated to the bot. Increasing upvote percentage.`
          );
          upvotePercent += DELEGATION_BONUS_PERCENT;
        }
      }

      // Check if post has been upvoted before
      const posturl = `${author}/${permlink}`;
      if (await isPostUpvoted(author, posturl, platform)) {
        console.log(
          `Post by @${author} with permlink ${permlink} has already been upvoted.`
        );
        return;
      }

      // Upvote the post
      var voter =
        platform === "hive"
          ? config.hive.username
          : platform === "steem"
          ? config.steem.username
          : config.blurt.username;
      var author = author;
      var permlink11 = permlink;
      var weight = upvotePercent;

      if (platform === "hive") {
        await retryOperation(async () => {
          await client.broadcast.vote(
            config.hive.posting,
            voter,
            author,
            permlink11,
            weight,
            function (err, result) {
              if (err) {
                console.error("Error broadcasting vote:", err);
              } else {
                console.log(
                  `Upvoted post by @${author} on ${platform} ${removeLastTwoCharacters(
                    `${weight}`
                  )}%`
                );
              }
            }
          );
        });
      } else if (platform === "steem") {
        await retryOperation(async () => {
          await client.broadcast.vote(
            config.steem.posting,
            voter,
            author,
            permlink11,
            weight,
            function (err, result) {
              if (err) {
                console.error("Error broadcasting vote:", err);
              } else {
                console.log(
                  `Upvoted post by @${author} on ${platform} ${removeLastTwoCharacters(
                    `${weight}`
                  )}%`
                );
              }
            }
          );
        });
      } else if (platform === "blurt") {
        await retryOperation(async () => {
          await client.broadcast.vote(
            config.blurt.posting,
            voter,
            author,
            permlink11,
            weight,
            function (err, result) {
              if (err) {
                console.error("Error broadcasting vote:", err);
              } else {
                console.log(
                  `Upvoted post by @${author} on ${platform} ${removeLastTwoCharacters(
                    `${weight}`
                  )}%`
                );
              }
            }
          );
        });
      }

      // Cache upvote data
      await cacheUpvote(author, posturl, platform, upvotePercent);

      // Leave a comment thanking the user
      const commentPermlink = `re-${author}-${permlink}`;
      const comment = `Thank you @${author}! Your Post been Verified and Upvoted! Keep up the great work!`;

      if (platform === "hive") {
        await retryOperation(async () => {
          client.broadcast.comment(
            config.hive.posting,
            author,
            permlink,
            platform === "hive"
              ? config.hive.username
              : platform === "steem"
              ? config.steem.username
              : config.blurt.username,
            commentPermlink,
            "",
            comment,
            JSON.stringify({}),
            function (err, result) {
              if (err) {
                console.error("Error broadcasting comment:", err);
              } else {
                console.log(`Comment posted successfully on ${platform}`);
              }
            }
          );
        });
      } else if (platform === "steem") {
        await retryOperation(async () => {
          client.broadcast.comment(
            config.steem.posting,
            author,
            permlink,
            platform === "hive"
              ? config.hive.username
              : platform === "steem"
              ? config.steem.username
              : config.blurt.username,
            commentPermlink,
            "",
            comment,
            JSON.stringify({}),
            function (err, result) {
              if (err) {
                console.error("Error broadcasting comment:", err);
              } else {
                console.log(`Comment posted successfully on ${platform}`);
              }
            }
          );
        });
      } else if (platform === "blurt") {
        await retryOperation(async () => {
          client.broadcast.comment(
            config.blurt.posting,
            author,
            permlink,
            platform === "hive"
              ? config.hive.username
              : platform === "steem"
              ? config.steem.username
              : config.blurt.username,
            commentPermlink,
            "",
            comment,
            JSON.stringify({}),
            function (err, result) {
              if (err) {
                console.error("Error broadcasting comment:", err);
              } else {
                console.log(`Comment posted successfully on ${platform}`);
              }
            }
          );
        });
      }
    }
  } catch (error) {
    console.error(`Error upvoting and commenting on post: ${error}`);
  }
}

// Check if a post contains the required hashtag
function postContainsHashtag(content, hashtag) {
  const hashtagPattern = new RegExp(`#${config.hashtag}`, "i"); // Case-insensitive search
  return hashtagPattern.test(content);
}

// Check for new posts and upvote
// Check for new posts and upvote
async function checkAndVoteOnPosts(platform, client) {
  const username =
    platform === "hive"
      ? config.hive.username
      : platform === "steem"
      ? config.steem.username
      : config.blurt.username;

  try {
    // Fetch account details to verify the username exists
    const accounts = await client.api.getAccountsAsync([username]);
    if (!accounts || accounts.length === 0) {
      console.error(`No accounts found for username: ${username}`);
      return;
    }

    // Fetch recent posts with the specified tag
    let recentPosts;
    if (platform === "hive" || platform === "steem") {
      recentPosts = await client.api.getDiscussionsByCreatedAsync({
        tag: config.hashtag,
        limit: 3
      });
    } else if (platform === "blurt") {
      recentPosts = await client.api.getDiscussionsByCreatedAsync({
        tag: config.hashtag,
        limit: 3
      });
    }

    if (!recentPosts || recentPosts.length === 0) {
      console.log(`No recent posts found for tag: ${config.hashtag}`);
      return;
    }

    for (const post of recentPosts) {
      const { author, permlink, body: content, json_metadata } = post;
      const tags = json_metadata ? JSON.parse(json_metadata).tags || [] : [];

      console.log(`Checking post by @${author} with permlink: ${permlink}`);
      //console.log(`Post tags: ${tags.join(", ")}`);

      // Check if post contains the required hashtag
      if (postContainsHashtag(content, config.hashtag)) {
        console.log(`Found post by @${author} with hashtag #${config.hashtag}`);
        await upvoteAndCommentOnPost(platform, client, author, permlink);
      } else {
        console.log(`No hashtag #${config.hashtag} found in post by @${author}`);
      }
    }
  } catch (error) {
    console.error(`Error checking and voting on posts: ${error}`);
  }
}

// Exporting the main function to be used externally
module.exports = {
  checkAndVoteOnPosts
};
