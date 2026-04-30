# Team Task Manager

A full-stack Team Task Manager for the assignment brief. Users can sign up, log in, create projects, add team members, assign tasks, update task status, and view dashboard metrics with overdue work.

## Features

- Authentication with signup/login and JWT sessions
- Admin and Member roles
- Project and team management
- Task creation, assignment, due dates, and status tracking
- Task priority labels: Low, Medium, High
- Kanban board with To Do, In Progress, and Done columns
- Dashboard with total tasks, status counts, upcoming work, and overdue tasks
- Dashboard completion rate, assigned-to-me count, and high-priority count
- REST APIs backed by PostgreSQL through Prisma
- Validation with Zod and relational database constraints

## Tech Stack

- Node.js + Express
- PostgreSQL
- Prisma ORM
- Vanilla HTML/CSS/JavaScript frontend
- Railway deployment ready

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and set `DATABASE_URL` and `JWT_SECRET`.

3. Run the database migration:

   ```bash
   npm run db:migrate
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:4000`.

The first signup is automatically promoted to `ADMIN`.

## REST API

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | Public | Create account |
| POST | `/api/auth/login` | Public | Login |
| GET | `/api/me` | Authenticated | Current user |
| GET | `/api/users` | Authenticated | List users |
| GET | `/api/projects` | Authenticated | List visible projects |
| POST | `/api/projects` | Admin | Create project |
| POST | `/api/projects/:id/members` | Admin | Add member to project |
| DELETE | `/api/projects/:projectId/members/:userId` | Admin | Remove member |
| GET | `/api/tasks` | Authenticated | List visible tasks |
| POST | `/api/tasks` | Authenticated | Create task |
| PATCH | `/api/tasks/:id` | Authenticated | Update task/status/priority |
| GET | `/api/dashboard` | Authenticated | Dashboard metrics |

## Railway Deployment

1. Push this repo to GitHub.
2. Create a new Railway project from the GitHub repo.
3. Add a Railway PostgreSQL database.
4. Set environment variables:

   ```text
   DATABASE_URL=<Railway Postgres connection URL>
   JWT_SECRET=<long random secret>
   ```

5. Deploy. Railway uses `npm start`, which runs `prisma migrate deploy` before starting the server.

## Submission Checklist

- Live URL: https://team-task-manager-production-7dd5.up.railway.app/
- GitHub repo: https://github.com/allaboutaryan/team-task-manager
- README: included
- Demo video: record 2-5 minutes showing signup, admin project creation, member assignment, task creation, status updates, and dashboard
