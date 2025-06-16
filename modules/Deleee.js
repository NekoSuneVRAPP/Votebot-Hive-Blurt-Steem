const { Delegation } = require("./DB/db");
const { blurt, dsteem, dhive, fs, config } = require("../depends");

// Environment variables
dhive.api.setOptions({ url: "https://api.hive.blog" });
const hivePrivateKey = dhive.auth.toWif(config.hive.username, config.hive.posting, "posting");
const hiveActiveKey = dhive.auth.toWif(config.hive.username, config.hive.active, "active");

dsteem.api.setOptions({ url: "https://api.steemit.com" });
const steemPrivateKey = dsteem.auth.toWif(config.steem.username, config.steem.posting, "posting");

blurt.api.setOptions({ url: "https://rpc.blurt.world" });
const blurtPrivateKey = blurt.auth.toWif(config.blurt.username, config.blurt.posting, "posting");

function getClient(platform = "hive") {
  switch (platform) {
    case "hive":
      return dhive;
    case "steem":
      return dsteem;
    case "blurt":
      return blurt;
    default:
      console.error(`Unknown platform: ${platform}`);
      return null;
  }
}

/**
 * Convert vesting shares to Hive Power
 * @param {number} vestingSharesAmount - Amount of vesting shares
 * @param {number} totalVestingSharesAmount - Total amount of vesting shares in the system
 * @param {number} totalVestingFundAmount - Total vesting fund amount
 * @returns {number} - HP equivalent of the vesting shares
 */

function vestingSharesToHP(
  vestingSharesAmount,
  totalVestingSharesAmount,
  totalVestingFundAmount
) {
  return (
    (vestingSharesAmount / totalVestingSharesAmount) * totalVestingFundAmount
  );
}

/**
 * Fetch total vesting shares and total vesting fund
 * @returns {Promise<Object>} - Total vesting shares and total vesting fund amounts
 */
async function fetchTotalVestingData() {
  // This is a placeholder. You need to implement this function to get the actual data
  // For example, query the blockchain or use an appropriate endpoint
  // For now, returning dummy values for demonstration
  return {
    totalVestingSharesAmount: 1000000, // Example value in VESTS
    totalVestingFundAmount: 10000 // Example value in HIVE
  };
}

/**
 * Get vesting shares to HP for selected delegators to a specific account
 * @param {string} platform - The platform (e.g., 'hive')
 * @param {string} username - The account to check for delegations
 * @param {string[]} selectedDelegators - List of selected delegators to filter
 * @returns {Promise<Object>} - Delegator's username and HP value for each delegation
 */

async function getSelectedDelegatorsHP(platform, selectedDelegators) {
  return new Promise((resolve, reject) => {
    const username =
      platform === "hive"
        ? config.hive.username : platform === "steem" ? config.steem.username : config.blurt.username;
    const client = getClient(platform);

    // Fetch the account details for the target account
    client.api.getAccounts([username], async (err, accounts) => {
      if (err) {
        reject(`Error fetching accounts: ${err.message}`);
        return;
      }

      if (accounts.length === 0) {
        reject(`Account ${username} not found.`);
        return;
      }

      const account = accounts[0];

      const vestingShares = parseFloat(account.vesting_shares.split(" ")[0]);

      // Fetch total vesting shares and fund data
      const { totalVestingSharesAmount, totalVestingFundAmount } =
        await fetchTotalVestingData();

      // Fetch the delegations to the account
      const delegations = await new Promise((resolve, reject) => {
        client.api.getVestingDelegations(username, "", 100, (err, response) => {
          if (err) {
            reject(`Error fetching delegations: ${err.message}`);
          } else {
            resolve(response);
          }
        });
      });

      // Process each delegation
      const results = {};
      for (const delegation of delegations) {
        const { delegator, vesting_shares: vestingSharesDelegation } =
          delegation;
        const vestingSharesDelegationAmount = parseFloat(
          vestingSharesDelegation.split(" ")[0]
        );

        // Check if the delegator is in the selected list
        if (selectedDelegators.includes(delegator)) {
          // Calculate HP
          const hp = vestingSharesToHP(
            vestingSharesDelegationAmount,
            totalVestingSharesAmount,
            totalVestingFundAmount
          );

          // If vesting shares amount is 0, HP should be 0
          results[delegator] = vestingSharesDelegationAmount === 0 ? 0 : hp;
        }
      }
      resolve(results);
    });
  });
}

// Helper function to get current delegations for an account
async function getDelegationsForAccount(platform, account, delegatee) {
  const client = getClient(platform);

  try {
    const delegation = await client.api.getVestingDelegationsAsync(
      account,
      delegatee,
      1
    );
    return delegation; // Return the resolved value
  } catch (err) {
    console.error(
      `Error fetching delegations for ${account} on ${platform}:`,
      err
    );
    return [];
  }
}

async function syncDelegations(platform, postowner) {
  // List of accounts to check for delegations
  const accounts = [config.hive.username, config.steem.username, config.blurt.username].filter(
    (username) => username !== ""
  );

  for (const account of accounts) {
    try {
      console.log(`Fetching current delegations for ${account} on ${platform}`);
      const currentDelegations = await getDelegationsForAccount(
        platform,
        postowner,
        account
      );

      // Find the amount for a specific delegatee, e.g., 'alloyxuastcur'
      const specificDelegation = currentDelegations.find(
        (item) => item.delegatee === account
      );

      const toggle1 = Boolean(specificDelegation);

      if (!specificDelegation) {
        console.log(
          `No delegation found for ${specificDelegatee} on ${platform}.`
        );
        continue;
      }

      const specificAmount = parseFloat(specificDelegation.vesting_shares) || 0;

      console.log(
        `Amount delegated to ${specificDelegatee}: ${specificAmount} on ${platform}`
      );

      // Check if the specific delegatee already exists in the database
      const existingDelegation = await Delegation.findOne({
        where: {
          delegator: postowner,
          delegatee: specificDelegatee,
          platform: platform
        }
      });

      if (existingDelegation) {
        // If the existing delegation is found and the amount is different, update it
        if (existingDelegation.amount !== specificAmount) {
          switch (platform) {
            case "hive":
              await Delegation.update(
                {
                  amountvast: specificAmount,
                  amounthp: 0,
                  enable: toggle1
                },
                {
                  where: {
                    id: existingDelegation.id
                  }
                }
              );
              break;
            case "steem":
              await Delegation.update(
                {
                  amountvast: specificAmount,
                  amountsp: 0,
                  enable: toggle1
                },
                {
                  where: {
                    id: existingDelegation.id
                  }
                }
              );
              break;
            case "blurt":
              await Delegation.update(
                {
                  amountvast: specificAmount,
                  amountbp: 0,
                  enable: toggle1
                },
                {
                  where: {
                    id: existingDelegation.id
                  }
                }
              );
              break;
          }
          console.log(
            `Updated delegation amount for ${postowner} to ${specificDelegatee} on ${platform}`
          );
        }
      } else if (specificAmount > 0) {
        // If the specific delegatee is not found in the database, create a new entry
        switch (platform) {
          case "hive":
            await Delegation.create({
              delegator: postowner,
              delegatee: specificDelegatee,
              platform: platform,
              amountvast: specificAmount,
              amounthp: 0,
              enable: toggle1
            });
            break;
          case "steem":
            await Delegation.create({
              delegator: postowner,
              delegatee: specificDelegatee,
              platform: platform,
              amountvast: specificAmount,
              amountsp: 0,
              enable: toggle1
            });
            break;
          case "blurt":
            await Delegation.create({
              delegator: postowner,
              delegatee: specificDelegatee,
              platform: platform,
              amountvast: specificAmount,
              amountbp: 0,
              enable: toggle1
            });
            break;
        }
        console.log(
          `New delegation recorded for ${postowner} to ${specificDelegatee} on ${platform}`
        );
      }
    } catch (error) {
      console.error(
        `Error syncing delegations for ${postowner} on ${platform}:`,
        error
      );
    }
  }
}

// Function to check if the user has delegated tokens
async function getDelegation(platform, delegator, delegatee) {
  const client = getClient(platform);

  try {
    const result = await client.api.getVestingDelegationsAsync(
      delegator,
      delegatee,
      1
    );
    return result.length > 0 && parseFloat(result[0].vesting_shares) > 0;
  } catch (error) {
    console.error(`Error checking delegation on ${platform}:`, error);
    return false;
  }
}

// Function to check if the user has delegated tokens from the database
async function hasDelegated(platform, delegator, delegatee) {
  try {
    const delegation = await Delegation.findOne({
      where: {
        delegator,
        delegatee,
        platform
      }
    });

    // If delegation exists and amount is greater than 0
    return delegation && delegation.enable;
  } catch (error) {
    console.error(
      `Error checking delegation from database for ${platform}:`,
      error
    );
    return false;
  }
}

module.exports = {
  syncDelegations,
  getDelegationsForAccount,
  hasDelegated,
  getSelectedDelegatorsHP
};
