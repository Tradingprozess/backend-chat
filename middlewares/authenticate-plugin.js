const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authenticatePlugin = () => {
  return async (req, res, next) => {
    try {
      const authKey = req.headers.auth;

      if (!authKey) {
        return res.status(401).json({ error: "Authentication key missing" });
      }

      const subAccountReferences = await prisma.subAccountReference.findMany({
        where: { authKey }
      });

      if (subAccountReferences.length === 0) {
        return res.status(401).json({ 
          error: "No access to this route. The auth key is invalid"
        });
      }

      req.references = subAccountReferences;
      next();
    } catch (error) {
      console.error("Authentication middleware error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
};

module.exports = authenticatePlugin;