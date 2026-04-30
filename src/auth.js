const jwt = require("jsonwebtoken");
const prisma = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, name: true, email: true, role: true }
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid session." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, signToken };
