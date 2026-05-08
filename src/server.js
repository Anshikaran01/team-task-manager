require("dotenv").config();

const path = require("path");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const prisma = require("./db");
const { requireAuth, requireAdmin, signToken } = require("./auth");
const {
  validate,
  signupSchema,
  loginSchema,
  projectSchema,
  memberSchema,
  taskSchema,
  taskUpdateSchema,
} = require("./validators");

const app = express();
const port = process.env.PORT || 4000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "..", "public")));

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

async function userCanAccessProject(userId, role, projectId) {
  if (role === "ADMIN") return true;
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return Boolean(membership);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "Team Task Manager" });
});

app.post("/api/auth/signup", validate(signupSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const userCount = await prisma.user.count();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: userCount === 0 ? "ADMIN" : "MEMBER",
      },
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", validate(loginSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { email: req.body.email },
    });
    if (
      !user ||
      !(await bcrypt.compare(req.body.password, user.passwordHash))
    ) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/users", requireAuth, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

app.get("/api/projects", requireAuth, async (req, res, next) => {
  try {
    const where =
      req.user.role === "ADMIN"
        ? {}
        : { members: { some: { userId: req.user.id } } };

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        tasks: true,
      },
    });

    res.json(projects);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/projects",
  requireAuth,
  requireAdmin,
  validate(projectSchema),
  async (req, res, next) => {
    try {
      const project = await prisma.project.create({
        data: {
          name: req.body.name,
          description: req.body.description || null,
          members: { create: { userId: req.user.id } },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
          },
          tasks: true,
        },
      });
      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/projects/:id/members",
  requireAuth,
  requireAdmin,
  validate(memberSchema),
  async (req, res, next) => {
    try {
      const project = await prisma.project.findUnique({
        where: { id: req.params.id },
      });
      const user = await prisma.user.findUnique({
        where: { id: req.body.userId },
      });
      if (!project || !user) {
        return res.status(404).json({ message: "Project or user not found." });
      }

      await prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: req.params.id,
            userId: req.body.userId,
          },
        },
        update: {},
        create: { projectId: req.params.id, userId: req.body.userId },
      });

      res.status(201).json({ message: "Member added to project." });
    } catch (error) {
      next(error);
    }
  },
);

app.delete(
  "/api/projects/:projectId/members/:userId",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      await prisma.projectMember.delete({
        where: {
          projectId_userId: {
            projectId: req.params.projectId,
            userId: req.params.userId,
          },
        },
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/tasks", requireAuth, async (req, res, next) => {
  try {
    const where =
      req.user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { assigneeId: req.user.id },
              { project: { members: { some: { userId: req.user.id } } } },
            ],
          };

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/tasks",
  requireAuth,
  validate(taskSchema),
  async (req, res, next) => {
    try {
      const isAllowed = await userCanAccessProject(
        req.user.id,
        req.user.role,
        req.body.projectId,
      );
      if (!isAllowed) {
        return res
          .status(403)
          .json({ message: "You do not belong to this project." });
      }

      if (
        req.user.role !== "ADMIN" &&
        req.body.assigneeId &&
        req.body.assigneeId !== req.user.id
      ) {
        return res
          .status(403)
          .json({ message: "Members can only assign tasks to themselves." });
      }

      const task = await prisma.task.create({
        data: {
          title: req.body.title,
          description: req.body.description || null,
          priority: req.body.priority || "MEDIUM",
          projectId: req.body.projectId,
          assigneeId: req.body.assigneeId || req.user.id,
          dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
          createdById: req.user.id,
        },
      });
      res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  },
);

app.patch(
  "/api/tasks/:id",
  requireAuth,
  validate(taskUpdateSchema),
  async (req, res, next) => {
    try {
      const existing = await prisma.task.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        return res.status(404).json({ message: "Task not found." });
      }

      const isAllowed = await userCanAccessProject(
        req.user.id,
        req.user.role,
        existing.projectId,
      );
      if (!isAllowed) {
        return res
          .status(403)
          .json({ message: "You cannot access this task." });
      }

      const memberEditFields = [
        "title",
        "description",
        "assigneeId",
        "dueDate",
        "priority",
      ];
      if (
        req.user.role !== "ADMIN" &&
        memberEditFields.some((field) => field in req.body)
      ) {
        return res
          .status(403)
          .json({ message: "Members can only update task status." });
      }

      const task = await prisma.task.update({
        where: { id: req.params.id },
        data: {
          ...("title" in req.body ? { title: req.body.title } : {}),
          ...("description" in req.body
            ? { description: req.body.description || null }
            : {}),
          ...("status" in req.body ? { status: req.body.status } : {}),
          ...("priority" in req.body ? { priority: req.body.priority } : {}),
          ...("assigneeId" in req.body
            ? { assigneeId: req.body.assigneeId || null }
            : {}),
          ...("dueDate" in req.body
            ? { dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null }
            : {}),
        },
      });
      res.json(task);
    } catch (error) {
      next(error);
    }
  },
);

app.get("/api/dashboard", requireAuth, async (req, res, next) => {
  try {
    const tasks = await prisma.task.findMany({
      where:
        req.user.role === "ADMIN"
          ? {}
          : {
              OR: [
                { assigneeId: req.user.id },
                { project: { members: { some: { userId: req.user.id } } } },
              ],
            },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    const now = new Date();
    const byStatus = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    const byPriority = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    let overdue = 0;
    let assignedToMe = 0;

    tasks.forEach((task) => {
      byStatus[task.status] += 1;
      byPriority[task.priority] += 1;
      if (task.assigneeId === req.user.id) assignedToMe += 1;
      if (task.dueDate && task.dueDate < now && task.status !== "DONE")
        overdue += 1;
    });

    const completionRate = tasks.length
      ? Math.round((byStatus.DONE / tasks.length) * 100)
      : 0;
    const overdueTasks = tasks
      .filter(
        (task) => task.dueDate && task.dueDate < now && task.status !== "DONE",
      )
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5);

    res.json({
      totalTasks: tasks.length,
      overdue,
      assignedToMe,
      completionRate,
      byStatus,
      byPriority,
      overdueTasks,
      recentTasks: tasks
        .sort(
          (a, b) =>
            new Date(a.dueDate || a.createdAt) -
            new Date(b.dueDate || b.createdAt),
        )
        .slice(0, 8),
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: "API route not found." });
  }
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error.code === "P2025") {
    return res.status(404).json({ message: "Record not found." });
  }
  res.status(500).json({ message: "Something went wrong." });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Team Task Manager running on port ${PORT}`);
});
