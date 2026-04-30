const state = {
  token: localStorage.getItem("ttm_token"),
  user: JSON.parse(localStorage.getItem("ttm_user") || "null"),
  projects: [],
  users: [],
  tasks: [],
  filter: "ALL"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

async function api(path, options = {}) {
  const method = options.method || "GET";
  const url = method === "GET" ? `${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}` : path;
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new Error(data?.message || "Request failed.");
  }
  return data;
}

async function refreshWorkspace(message) {
  await loadData();
  if (message) setMessage($("#appMessage"), message);
}

function setMessage(target, text, isError = false) {
  target.textContent = text;
  target.style.color = isError ? "#b42318" : "#26734d";
  if (text) setTimeout(() => (target.textContent = ""), 3500);
}

function saveSession(payload) {
  state.token = payload.token;
  state.user = payload.user;
  localStorage.setItem("ttm_token", payload.token);
  localStorage.setItem("ttm_user", JSON.stringify(payload.user));
}

function clearSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("ttm_token");
  localStorage.removeItem("ttm_user");
}

function renderShell() {
  const loggedIn = Boolean(state.token && state.user);
  $("#authView").classList.toggle("hidden", loggedIn);
  $("#appView").classList.toggle("hidden", !loggedIn);

  if (loggedIn) {
    $("#profileName").textContent = state.user.name;
    $("#profileRole").textContent = state.user.role;
    $$(".admin-only").forEach((node) => node.classList.toggle("hidden", state.user.role !== "ADMIN"));
  }
}

function optionList(items, placeholder, label = (item) => item.name) {
  return [`<option value="">${placeholder}</option>`]
    .concat(items.map((item) => `<option value="${item.id}">${label(item)}</option>`))
    .join("");
}

function setView(view) {
  $$(".nav").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((node) => node.classList.add("hidden"));
  $(`#${view}View`).classList.remove("hidden");
  $("#viewTitle").textContent = view[0].toUpperCase() + view.slice(1);
  $("#viewEyebrow").textContent = view === "dashboard" ? "Overview" : "Manage";
}

async function loadData() {
  const [users, projects, tasks, dashboard] = await Promise.all([
    api("/api/users"),
    api("/api/projects"),
    api("/api/tasks"),
    api("/api/dashboard")
  ]);

  state.users = users;
  state.projects = projects;
  state.tasks = tasks;

  renderDashboard(dashboard);
  renderProjects();
  renderTasks();
  hydrateForms();
}

function hydrateForms() {
  const visibleProjects =
    state.user.role === "ADMIN"
      ? state.projects
      : state.projects.filter((project) => project.members.some((member) => member.userId === state.user.id));

  $$("select[name='projectId']").forEach((select) => {
    select.innerHTML = optionList(visibleProjects, "Select project");
  });

  $$("select[name='userId']").forEach((select) => {
    select.innerHTML = optionList(state.users, "Select user", (user) => `${user.name} (${user.role})`);
  });

  $$("select[name='assigneeId']").forEach((select) => {
    select.innerHTML = optionList(state.users, state.user.role === "ADMIN" ? "Unassigned" : "Assign to me", (user) => user.name);
    if (state.user.role !== "ADMIN") select.value = state.user.id;
  });
}

function formatDate(dateValue) {
  if (!dateValue) return "No due date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateValue));
}

function label(value) {
  return value.replace("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isOverdue(task) {
  return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "DONE";
}

function renderDashboard(dashboard) {
  $("#totalTasks").textContent = dashboard.totalTasks;
  $("#todoTasks").textContent = dashboard.byStatus.TODO;
  $("#progressTasks").textContent = dashboard.byStatus.IN_PROGRESS;
  $("#doneTasks").textContent = dashboard.byStatus.DONE;
  $("#completionRate").textContent = `${dashboard.completionRate}%`;
  $("#assignedTasks").textContent = dashboard.assignedToMe;
  $("#highPriorityTasks").textContent = dashboard.byPriority.HIGH;
  $("#overdueTasks").textContent = dashboard.overdue;
  $("#recentTasks").innerHTML = dashboard.recentTasks.length
    ? dashboard.recentTasks.map(taskTemplate).join("")
    : `<p class="hint">No tasks yet.</p>`;
  $("#overdueList").innerHTML = dashboard.overdueTasks.length
    ? dashboard.overdueTasks.map(taskTemplate).join("")
    : `<p class="hint">No overdue work.</p>`;
}

function renderProjects() {
  $("#projectsList").innerHTML = state.projects.length
    ? state.projects
        .map(
          (project) => `
            <article class="card">
              <h3>${project.name}</h3>
              <p>${project.description || "No description"}</p>
              <div class="chips">
                <span class="chip">${project.tasks.length} tasks</span>
                ${project.members.map((member) => `<span class="chip">${member.user.name}</span>`).join("")}
              </div>
            </article>`
        )
        .join("")
    : `<p class="hint">No projects yet.</p>`;
}

function statusSelect(task) {
  return `
    <select data-task-status="${task.id}">
      <option value="TODO" ${task.status === "TODO" ? "selected" : ""}>To do</option>
      <option value="IN_PROGRESS" ${task.status === "IN_PROGRESS" ? "selected" : ""}>In progress</option>
      <option value="DONE" ${task.status === "DONE" ? "selected" : ""}>Done</option>
    </select>`;
}

function taskTemplate(task) {
  return `
    <article class="task-item priority-${task.priority}">
      <div>
        <h3>${task.title} <span class="status ${task.status}">${label(task.status)}</span></h3>
        <div class="task-meta">
          ${task.project?.name || "Project"} - ${task.assignee?.name || "Unassigned"} -
          <span class="${isOverdue(task) ? "overdue" : ""}">${formatDate(task.dueDate)}</span>
        </div>
        <div class="chips">
          <span class="chip priority-chip ${task.priority}">${label(task.priority)} priority</span>
          ${isOverdue(task) ? `<span class="chip overdue-chip">Overdue</span>` : ""}
        </div>
        ${task.description ? `<p>${task.description}</p>` : ""}
      </div>
      <div class="task-actions">${statusSelect(task)}</div>
    </article>`;
}

function kanbanCardTemplate(task) {
  return `
    <article class="kanban-card priority-${task.priority}">
      <h4>${task.title}</h4>
      <div class="task-meta">${task.project?.name || "Project"} - ${task.assignee?.name || "Unassigned"}</div>
      <div class="chips">
        <span class="chip priority-chip ${task.priority}">${label(task.priority)}</span>
        <span class="chip ${isOverdue(task) ? "overdue-chip" : ""}">${formatDate(task.dueDate)}</span>
      </div>
      ${statusSelect(task)}
    </article>`;
}

function renderTasks() {
  const tasks = state.filter === "ALL" ? state.tasks : state.tasks.filter((task) => task.status === state.filter);
  $("#tasksList").innerHTML = tasks.length ? tasks.map(taskTemplate).join("") : `<p class="hint">No matching tasks.</p>`;

  const columns = {
    TODO: $("#kanbanTodo"),
    IN_PROGRESS: $("#kanbanProgress"),
    DONE: $("#kanbanDone")
  };

  Object.entries(columns).forEach(([status, node]) => {
    const columnTasks = state.tasks.filter((task) => task.status === status);
    node.innerHTML = columnTasks.length ? columnTasks.map(kanbanCardTemplate).join("") : `<p class="hint">No tasks.</p>`;
  });

  $("#todoCount").textContent = state.tasks.filter((task) => task.status === "TODO").length;
  $("#progressCount").textContent = state.tasks.filter((task) => task.status === "IN_PROGRESS").length;
  $("#doneCount").textContent = state.tasks.filter((task) => task.status === "DONE").length;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function boot() {
  renderShell();
  if (state.token && state.user) {
    try {
      await loadData();
    } catch (error) {
      clearSession();
      renderShell();
      setMessage($("#authMessage"), "Please login again.", true);
    }
  }
}

$$("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.authTab;
    $$("[data-auth-tab]").forEach((node) => node.classList.toggle("active", node === button));
    $("#loginForm").classList.toggle("hidden", tab !== "login");
    $("#signupForm").classList.toggle("hidden", tab !== "signup");
  });
});

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    saveSession(await api("/api/auth/login", { method: "POST", body: JSON.stringify(formData(event.target)) }));
    renderShell();
    await loadData();
  } catch (error) {
    setMessage($("#authMessage"), error.message, true);
  }
});

$("#signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    saveSession(await api("/api/auth/signup", { method: "POST", body: JSON.stringify(formData(event.target)) }));
    renderShell();
    await loadData();
  } catch (error) {
    setMessage($("#authMessage"), error.message, true);
  }
});

$("#logoutBtn").addEventListener("click", () => {
  clearSession();
  renderShell();
});

$$(".nav").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));

$("#projectForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/projects", { method: "POST", body: JSON.stringify(formData(event.target)) });
    event.target.reset();
    await refreshWorkspace("Project created.");
  } catch (error) {
    setMessage($("#appMessage"), error.message, true);
  }
});

$("#memberForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.target);
  try {
    await api(`/api/projects/${data.projectId}/members`, { method: "POST", body: JSON.stringify({ userId: data.userId }) });
    event.target.reset();
    await refreshWorkspace("Member added.");
  } catch (error) {
    setMessage($("#appMessage"), error.message, true);
  }
});

$("#taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(event.target);
  const payload = {
    ...data,
    dueDate: data.dueDate ? new Date(`${data.dueDate}T12:00:00`).toISOString() : null,
    assigneeId: data.assigneeId || null
  };

  try {
    await api("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
    event.target.reset();
    await refreshWorkspace("Task created.");
  } catch (error) {
    setMessage($("#appMessage"), error.message, true);
  }
});

document.addEventListener("change", async (event) => {
  const taskId = event.target.dataset.taskStatus;
  if (!taskId) return;

  try {
    await api(`/api/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status: event.target.value }) });
    await refreshWorkspace("Task status updated.");
  } catch (error) {
    setMessage($("#appMessage"), error.message, true);
  }
});

$$(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.status;
    $$(".filter").forEach((node) => node.classList.toggle("active", node === button));
    renderTasks();
  });
});

boot();
