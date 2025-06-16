const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");

// Initialize Sequelize
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(__dirname, "../../db.sqlite3"),
  logging: false
});

// Define the Upvote model
const Upvote = sequelize.define(
  "Upvote",
  {
    username: {
      type: DataTypes.STRING,
      allowNull: false
    },
    posturl: {
      type: DataTypes.STRING,
      allowNull: false
    },
    platform: {
      type: DataTypes.STRING,
      allowNull: false
    },
    upvotePercent: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW
    }
  },
  {
    timestamps: false
  }
);

// Define the Donation model
const Donation = sequelize.define(
  "Donation",
  {
    username: {
      type: DataTypes.STRING,
      allowNull: false
    },
    platform: {
      type: DataTypes.STRING,
      allowNull: false
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING, // 'HIVE', 'HBD', 'SBD', etc.
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW
    }
  },
  {
    timestamps: false
  }
);

// Define the Delegation model
const Delegation = sequelize.define(
  "Delegation",
  {
    delegator: {
      type: DataTypes.STRING,
      allowNull: false
    },
    delegatee: {
      type: DataTypes.STRING,
      allowNull: false
    },
    platform: {
      type: DataTypes.STRING,
      allowNull: false
    },
    amountvast: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0
    },
    amounthp: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 0
    },
    amountbp: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 0
    },
    amountsp: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 0
    },
    enable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.NOW
    }
  },
  {
    timestamps: false
  }
);

// Sync the database
async function syncDatabase() {
  await sequelize.sync();
}

syncDatabase();

module.exports = {
  Delegation,
  Donation,
  Upvote
};
