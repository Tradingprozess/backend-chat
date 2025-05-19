const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const TradovateAPIService = require("../services/TradovateAPIService");
const { generateOtp } = require("../methods/utils");
const { v4: uuidv4 } = require("uuid");
const TradingService = require("../services/TradingService");

const createSubAccountReference = async (req, res, next) => {
  try {
    const { id, subAccountId, accountId, broker, code, userId } = req.body;
    const allowedBrokers = ["Atas", "Ninja Trader", "MT5", "MT4"];

    // Validation checks
    if (!subAccountId)
      return res.status(400).json({ error: "Invalid Sub Account Id" });
    if (!accountId)
      return res.status(400).json({ error: "Invalid Account Id" });
    if (!broker) return res.status(400).json({ error: "Invalid Broker" });
    if (!allowedBrokers.includes(broker)) {
      return res.status(400).json({
        error: `Broker not allowed. Allowed brokers: ${allowedBrokers.join(
          ","
        )}`,
      });
    }

    // Get user's subaccounts
    const subAccounts = await prisma.subAccount.findMany({
      where: { userId: userId },
      select: { id: true },
    });
    const subAccountIds = subAccounts.map((acc) => acc.id);

    if (!subAccountIds.includes(subAccountId)) {
      return res.status(400).json({ error: "Invalid Sub Account Id" });
    }

    // Check for existing references
    const similarReference = await prisma.subAccountReference.findFirst({
      where: {
        subAccountId: { in: subAccountIds },
        accountId,
        broker,
      },
    });

    if (similarReference && similarReference.status === "active") {
      return res
        .status(400)
        .json({ error: "Cannot attach same account again" });
    }

    // Ninja Trader flow
    if (broker === "Ninja Trader" && !code) {
      let subAccountReference = similarReference;
      if (!subAccountReference) {
        subAccountReference = await prisma.subAccountReference.create({
          data: {
            subAccountId,
            accountId,
            broker,
            status: "inactive",
            authKey: "-",
          },
        });
      }
      const state = {
        id: subAccountReference.id,
        broker,
        subAccountId,
        accountId,
      };
      return res.json({ url: TradovateAPIService.GetOAuthUrl(state) });
    }

    // Check existing active references
    const existingReference = await prisma.subAccountReference.findFirst({
      where: {
        subAccountId: { in: subAccountIds },
        status: "active",
        broker,
      },
    });

    // Handle non-Ninja brokers
    if (existingReference && broker !== "Ninja Trader") {
      const newReference = await prisma.subAccountReference.create({
        data: {
          subAccountId,
          accountId,
          broker,
          status: "active",
          authKey: existingReference.authKey,
        },
      });
      return res.json({
        accountReference: newReference,
        usingExistingReference: true,
      });
    }

    // Ninja Trader authorization
    if (broker === "Ninja Trader" && id && code) {
      const authResponse = await TradovateAPIService.GetOAuthToken(code);
      if (!authResponse?.access_token) {
        return res.status(400).json({ error: "Authorization failed" });
      }

      const authKey = authResponse.access_token;
      const accounts = await TradovateAPIService.GetAccountsList(authKey);
      const account = accounts.find(
        (acc) => acc.name === accountId || acc.nickname === accountId
      );

      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const updatedReference = await prisma.subAccountReference.update({
        where: { id },
        data: {
          authKey,
          status: "active",
          additionalData: {
            userId: account.userId,
            accountId: account.id,
          },
        },
      });

      await TradovateAPIService.InitializeForUser(
        authKey,
        account.id,
        accountId,
        account.userId
      );

      return res.json({
        accountReference: updatedReference,
        refreshBase: true,
      });
    }

    // MT4/MT5 flow
    if (["MT4", "MT5"].includes(broker)) {
      const newReference = await prisma.subAccountReference.create({
        data: {
          subAccountId,
          accountId,
          broker,
          status: "active",
          authKey: uuidv4(),
        },
      });
      return res.json({ accountReference: newReference });
    }

    // OTP flow for other brokers
    const existingOtp = await prisma.otpCode.findFirst({
      where: {
        userId: subAccountId,
        purpose: "auto-sync",
      },
    });

    if (existingOtp) {
      return res.status(400).json({ error: "OTP already exists" });
    }

    const newReference = await prisma.subAccountReference.create({
      data: {
        subAccountId,
        accountId,
        broker,
        status: "inactive",
        authKey: uuidv4(),
      },
    });

    const otp = generateOtp(6);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 100);

    await prisma.otpCode.create({
      data: {
        expiresAt,
        userId: subAccountId,
        code: Number(otp),
        purpose: "auto-sync",
      },
    });

    res.json({ otp, accountReference: newReference });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const authenticateAutoSyncPlugin = async (req, res, next) => {
  try {
    console.log("Trigred authenticateAutoSyncPlugin Api", req.references)
    if (!req.references) {
      return res.status(400).json({ error: "Invalid Data" });
    }

    const referenceAccountIds = req.references.map(
      (reference) => reference.accountId
    );
    console.log("Trigred referenceAccountIds ", referenceAccountIds)


    if (referenceAccountIds.length === 0) {
      return res.status(404).json({ error: "No account references found" });
    }

    const subAccount = await prisma.subAccount.findFirst({
      where: { id: req.references[0].subAccountId },
    });

    console.log("subAccount ", subAccount)
    
    const user = await prisma.user.findFirst({
      where: { id: subAccount.userId },
    });
    console.log("user ", user)
    console.log("referenceAccountIds ", referenceAccountIds)

    return res
      .status(200)
      .json({ data: { accountIds: referenceAccountIds, user: user } });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
};

const verifyAutoSync = async (req, res) => {
  try {

    const { code } = req.body;
    console.log("Trigred Code Api", code)
    if (!code) return res.status(400).json({ error: "Code is required for authentication" });

    const otpData = await prisma.otpCode.findFirst({
      where: { code: parseInt(code) },
    });

    if (!otpData) return res.status(400).json({ error: "Invalid Code" });

    console.log("otpData", otpData)
    
    const reference = await prisma.subAccountReference.findFirst({
      where: {
        subAccountId: otpData.userId,
        broker: "Atas"
      },
    });

    if (!reference) {
      return res.status(400).json({ error: "No relevant reference found" });
    }

    const updatedReference = await prisma.subAccountReference.update({
      where: { id: reference.id },
      data: { status: "active" },
    });

    console.log("updatedReference.authKey", updatedReference.authKey)

    res.status(200).json({ data: { authKey: updatedReference.authKey } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getAutoSyncReferences = async (req, res) => {
  try {
    console.log("Trigred getAutoSyncReferences Api", req.params)

    const { subAccountId, broker } = req.params;

    const subAccount = await prisma.subAccount.findUnique({
      where: { id: subAccountId },
      select: { userId: true },
    });
    
    console.log("subAccount",subAccount)

    if (!subAccount || !subAccount.userId) {
      return res.status(400).json({ error: "Invalid subaccount" });
    }


    const references = await prisma.subAccountReference.findMany({
      where: {
        subAccountId,
        broker,
      },
    });
    console.log("references",references)


    res.status(200).json({ references });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const deleteAutoSyncReference = async (req, res) => {
  try {
    const { id } = req.params;

    const reference = await prisma.subAccountReference.findUnique({
      where: { id },
    });

    if (!reference) {
      return res.status(404).json({ error: "Reference not found" });
    }

    // Verify ownership
    const subAccount = await prisma.subAccount.findUnique({
      where: { id: reference.subAccountId },
      select: { userId: true },
    });

    if (!subAccount || !subAccount.userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await prisma.$transaction([
      prisma.otpCode.deleteMany({
        where: { userId: reference.subAccountId },
      }),
      prisma.subAccountReference.delete({
        where: { id },
      }),
    ]);

    if (reference.broker === "Ninja Trader" && reference.additionalData) {
      const { userId, accountId } = reference.additionalData;
      TradovateAPIService.CloseConnection(userId, accountId);
    }

    res.json({ message: "Reference deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// ==================== Auto Sync Hooks ============================= //

const addTradeHook = async (req, res, next) => {
  try {
    // {"tradeId": "827709905","accountId": "207224084","type": "BUY","securityId": "BTCUSD","price": 83699.07,"volume": 0.10,"commission": 0.00,"captureEntry": true,"captureExit": false,"image": "entry_827709905.png"}
    const { tradeId, accountId, type, securityId, price, volume, commission, image, captureEntry, captureExit } = req.body;
    console.log("Add Trade Api Call",tradeId, accountId, type, securityId, price, volume, commission);
    const authKey = req.headers.auth;
    const broker = req.references[0].broker;
    console.log("authKey broker",authKey,broker);

    await TradingService.insertAutoSyncTrade(broker, authKey, accountId, tradeId, type, securityId, price, volume, commission, image, captureEntry, captureExit);

    return res.status(200).json({ message: "Trade added successfully" });
  }
  catch (error) {
    console.log(error)
    return res.status(500).json({ error: error.message });
  }
}

const limitDataHook = async (req, res, next) => {
  try {
    console.log("Trigred limitDataHook Api", req.body)

    const { accountId, type, price, securityId } = req.body;
    const authKey = req.headers.auth;

    if (!accountId || !type || price === undefined) {
      return res.status(400).json({ error: "Invalid Data" });
    }

    const broker = req.references[0].broker;

    const { user, subAccount } = await TradingService.validateSubAccount(accountId, authKey, broker);

    await TradingService.applyStopLossOrTakeProfit(subAccount, securityId, type, price);

    return res.status(200).json({ message: "Trade Limit Updated successfully" });
  }
  catch (error) {
    console.log(error)
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  createSubAccountReference,
  verifyAutoSync,
  authenticateAutoSyncPlugin,
  getAutoSyncReferences,
  deleteAutoSyncReference,
  addTradeHook,
  limitDataHook
};
