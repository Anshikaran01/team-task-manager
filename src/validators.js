const { z } = require("zod");

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(100),
  role: z.enum(["ADMIN", "MEMBER"]).optional()
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

const projectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().nullable()
});

const memberSchema = z.object({
  userId: z.string().min(1)
});

const taskSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(800).optional().nullable(),
  projectId: z.string().min(1),
  assigneeId: z.string().min(1).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueDate: z.string().datetime().optional().nullable()
});

const taskUpdateSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(800).optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assigneeId: z.string().min(1).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable()
});

function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed.",
        errors: parsed.error.flatten().fieldErrors
      });
    }
    req.body = parsed.data;
    next();
  };
}

module.exports = {
  validate,
  signupSchema,
  loginSchema,
  projectSchema,
  memberSchema,
  taskSchema,
  taskUpdateSchema
};
