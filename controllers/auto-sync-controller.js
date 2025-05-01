const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const TradovateAPIService = require("../services/TradovateAPIService");
const { generateOtp } = require("../methods/utils");
const { v4: uuidv4 } = require("uuid");

const createSubAccountReference = async (req, res, next) => {
  try {
    const { id, subAccountId, accountId, broker, code, userId } = req.body;
    const allowedBrokers = ["Atas", "Ninja Trader", "MT5", "MT4"];

    console.log("Data to create ref:", {
      id,
      subAccountId,
      accountId,
      broker,
      code,
      userId,
    });

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
    if (!req.references) {
      return res.status(400).json({ error: "Invalid Data" });
    }

    const referenceAccountIds = req.references.map(
      (reference) => reference.accountId
    );

    if (referenceAccountIds.length === 0) {
      return res.status(404).json({ error: "No account references found" });
    }

    const subAccount = await prisma.subAccount.findFirst({
      where: { id: req.references[0].subAccountId },
    });

    const user = await prisma.user.findFirst({
      where: { id: subAccount.userId },
    });

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
    if (!code) return res.status(400).json({ error: "Code required" });

    const otpData = await prisma.otpCode.findFirst({
      where: { code: parseInt(code) },
    });

    if (!otpData) return res.status(400).json({ error: "Invalid code" });
    if (new Date() > otpData.expiresAt) {
      return res.status(400).json({ error: "Code expired" });
    }

    const reference = await prisma.subAccountReference.findFirst({
      where: {
        subAccountId: otpData.userId,
        status: "inactive",
      },
    });

    if (!reference) {
      return res.status(400).json({ error: "No reference found" });
    }

    const updatedReference = await prisma.subAccountReference.update({
      where: { id: reference.id },
      data: { status: "active" },
    });

    await prisma.otpCode.deleteMany({
      where: { userId: otpData.userId },
    });

    res.json({ authKey: updatedReference.authKey });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getAutoSyncReferences = async (req, res) => {
  try {
    const { subAccountId, broker } = req.params;

    const subAccount = await prisma.subAccount.findUnique({
      where: { id: subAccountId },
      select: { userId: true },
    });

    console.log("SubAccount:", subAccount);
    if (!subAccount || !subAccount.userId) {
      return res.status(400).json({ error: "Invalid subaccount" });
    }

    const references = await prisma.subAccountReference.findMany({
      where: {
        subAccountId,
        broker,
      },
    });

    res.json({ references });
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

module.exports = {
  createSubAccountReference,
  verifyAutoSync,
  authenticateAutoSyncPlugin,
  getAutoSyncReferences,
  deleteAutoSyncReference,
};
