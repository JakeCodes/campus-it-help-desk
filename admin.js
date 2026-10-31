const user = JSON.parse(localStorage.getItem("user"));
if (!user || user.role !== "admin") window.location.href = "login.html";

const requestList = document.getElementById("request-list");
const userList = document.getElementById("user-list");
const userForm = document.getElementById("userForm");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");
const paginationEl = document.getElementById("pagination");

const STATUSES = ["Open", "In Progress", "Resolved"];
const PRIORITY_ORDER = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
const PRIORITY_COLORS = { Low: "#6c757d", Medium: "#0066cc", High: "#e67e00", Urgent: "#cc0000" };
const PAGE_SIZE = 10;
let currentPage = 1;
let allTickets = [];
let staffUsers = [];

// ---------- Stats ----------

function updateStats() {
    document.getElementById("count-all").textContent = allTickets.length;
    document.getElementById("count-open").textContent = allTickets.filter(t => t.status === "Open").length;
    document.getElementById("count-progress").textContent = allTickets.filter(t => t.status === "In Progress").length;
    document.getElementById("count-resolved").textContent = allTickets.filter(t => t.status === "Resolved").length;
}

function filterByStat(status) {
    document.getElementById("filter-status").value = status;
    currentPage = 1;
    renderTickets();
}

// ---------- Filters & sort ----------

function getFilters() {
    return {
        search: document.getElementById("search").value.toLowerCase(),
        status: document.getElementById("filter-status").value,
        priority: document.getElementById("filter-priority").value,
        category: document.getElementById("filter-category").value,
        sort: document.getElementById("sort-by").value
    };
}

function applyFiltersAndSort() {
    const { search, status, priority, category, sort } = getFilters();
    let list = allTickets.filter(t => {
        if (status && t.status !== status) return false;
        if (priority && t.priority !== priority) return false;
        if (category && t.category !== category) return false;
        if (search && !t.title.toLowerCase().includes(search) &&
            !t.studentName.toLowerCase().includes(search) &&
            !t.description.toLowerCase().includes(search)) return false;
        return true;
    });

    list.sort((a, b) => {
        if (sort === "date-asc") return new Date(a.createdAt) - new Date(b.createdAt);
        if (sort === "date-desc") return new Date(b.createdAt) - new Date(a.createdAt);
        if (sort === "priority-desc") return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
        if (sort === "priority-asc") return (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0);
        if (sort === "status") return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return list;
}

// ---------- Pagination ----------

function renderPagination(total) {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) { paginationEl.innerHTML = ""; return; }

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);

    paginationEl.innerHTML = `
        <span class="page-info">Showing ${start}–${end} of ${total}</span>
        <button class="btn btn-outline page-btn" ${currentPage === 1 ? "disabled" : ""} onclick="changePage(-1)">← Prev</button>
        <span class="page-num">Page ${currentPage} of ${totalPages}</span>
        <button class="btn btn-outline page-btn" ${currentPage === totalPages ? "disabled" : ""} onclick="changePage(1)">Next →</button>
    `;
}

function changePage(delta) {
    currentPage += delta;
    renderTickets();
    window.scrollTo(0, 0);
}

// ---------- Render ----------

async function loadTickets() {
    const res = await fetch("/api/tickets");
    allTickets = await res.json();
    updateStats();
    renderTickets();
}

async function loadStaff() {
    const res = await fetch("/api/users");
    const users = await res.json();
    staffUsers = users.filter(u => u.role === "admin");
}

function renderTickets() {
    const filtered = applyFiltersAndSort();
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;

    const page = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    renderPagination(filtered.length);

    if (page.length === 0) {
        requestList.innerHTML = "<p style='padding:12px'>No tickets match your filters.</p>";
        return;
    }

    requestList.innerHTML = "";
    page.forEach(function (ticket) {
        const card = document.createElement("div");
        const priorityColor = PRIORITY_COLORS[ticket.priority] || "#6c757d";
        const comments = ticket.comments || [];
        const notes = ticket.internalNotes || [];

        // Assignee options
        const assignOptions = staffUsers.map(s =>
            `<option value="${s.name}" ${ticket.assignedTo === s.name ? "selected" : ""}>${s.name}</option>`
        ).join("");

        const isImage = ticket.attachment && /\.(png|jpg|jpeg|gif|webp)$/i.test(ticket.attachment.name);
        const attachHtml = ticket.attachment ? (
            isImage
                ? `<div style="margin-top:8px"><a href="${ticket.attachment.url}" target="_blank"><img src="${ticket.attachment.url}" alt="${ticket.attachment.name}" style="max-width:100%;max-height:160px;border-radius:4px;border:1px solid #ddd"></a></div>`
                : `<div style="margin-top:8px"><a href="${ticket.attachment.url}" target="_blank" style="color:#0066cc">📎 ${ticket.attachment.name}</a></div>`
        ) : "";

        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
                <h3 style="margin:0;flex:1;margin-right:8px"></h3>
                <span class="priority-badge" style="background:${priorityColor}"></span>
            </div>
            <p style="margin:4px 0"><strong>From:</strong> <span class="from"></span></p>
            <p style="margin:4px 0"><strong>Category:</strong> <span class="category"></span></p>
            <p style="margin:4px 0"><strong>Submitted:</strong> <span class="created"></span></p>
            <p class="desc" style="margin:8px 0;color:#555"></p>
            ${attachHtml}
            <p style="margin:6px 0"><strong>Status:</strong> <select class="status-sel"></select></p>
            <p style="margin:6px 0"><strong>Assigned to:</strong>
                <select class="assign-sel">
                    <option value="">Unassigned</option>
                    ${assignOptions}
                </select>
            </p>
            <div style="margin-top:12px;display:flex;justify-content:flex-end">
                <button class="btn delete-btn" style="padding:4px 12px;font-size:13px;border-color:#cc0000;color:#cc0000;background:transparent">Delete Ticket</button>
            </div>

            <div class="comment-block" style="margin-top:14px;border-top:1px solid #eee;padding-top:10px">
                <strong>Student-visible Comments (${comments.length})</strong>
                <div class="comment-list" style="margin:8px 0"></div>
                <div style="display:flex;gap:8px;margin-top:6px">
                    <input class="comment-input" type="text" placeholder="Add comment (visible to student)..." style="flex:1;padding:6px 10px;border:1px solid #ccc;border-radius:4px;font-size:13px">
                    <button class="comment-btn btn btn-primary" style="padding:6px 12px;font-size:13px">Send</button>
                </div>
            </div>

            <div class="note-block" style="margin-top:14px;border-top:1px solid #eee;padding-top:10px">
                <strong style="color:#8b4513">🔒 Internal Notes (${notes.length})</strong>
                <div class="note-list" style="margin:8px 0"></div>
                <div style="display:flex;gap:8px;margin-top:6px">
                    <input class="note-input" type="text" placeholder="Add private note (staff only)..." style="flex:1;padding:6px 10px;border:1px solid #ccc;border-radius:4px;font-size:13px">
                    <button class="note-btn btn" style="padding:6px 12px;font-size:13px;background:#8b4513;color:#fff;border-color:#8b4513">Add</button>
                </div>
            </div>
        `;

        card.querySelector("h3").textContent = ticket.title;
        card.querySelector(".priority-badge").textContent = ticket.priority || "Medium";
        card.querySelector(".from").textContent = ticket.studentName;
        card.querySelector(".category").textContent = ticket.category;
        card.querySelector(".created").textContent = new Date(ticket.createdAt).toLocaleDateString();
        card.querySelector(".desc").textContent = ticket.description;

        // Status select
        const statusSel = card.querySelector(".status-sel");
        STATUSES.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s; opt.textContent = s;
            opt.selected = s === ticket.status;
            statusSel.appendChild(opt);
        });
        statusSel.addEventListener("change", () => {
            fetch("/api/tickets/" + ticket.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: statusSel.value }) })
                .then(() => { const t = allTickets.find(x => x.id === ticket.id); if (t) { t.status = statusSel.value; updateStats(); } });
        });

        // Assign select
        const assignSel = card.querySelector(".assign-sel");
        assignSel.addEventListener("change", () => {
            fetch("/api/tickets/" + ticket.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedTo: assignSel.value || null }) })
                .then(() => { const t = allTickets.find(x => x.id === ticket.id); if (t) t.assignedTo = assignSel.value || null; });
        });

        // Delete ticket
        card.querySelector(".delete-btn").addEventListener("click", async () => {
            if (!confirm("Delete this ticket? This cannot be undone.")) return;
            const r = await fetch("/api/tickets/" + ticket.id, { method: "DELETE" });
            if (r.ok) {
                allTickets = allTickets.filter(x => x.id !== ticket.id);
                updateStats();
                renderTickets();
            }
        });

        // Comments
        const commentList = card.querySelector(".comment-list");
        renderMessages(commentList, comments);
        const commentInput = card.querySelector(".comment-input");
        card.querySelector(".comment-btn").addEventListener("click", async () => {
            const text = commentInput.value.trim();
            if (!text) return;
            const r = await fetch("/api/tickets/" + ticket.id + "/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ author: user.name, text }) });
            if (r.ok) {
                const c = await r.json();
                ticket.comments = ticket.comments || [];
                ticket.comments.push(c);
                renderMessages(commentList, ticket.comments);
                commentInput.value = "";
                card.querySelector(".comment-block strong").textContent = "Student-visible Comments (" + ticket.comments.length + ")";
            }
        });

        // Internal notes
        const noteList = card.querySelector(".note-list");
        renderMessages(noteList, notes, "#fff8f0");
        const noteInput = card.querySelector(".note-input");
        card.querySelector(".note-btn").addEventListener("click", async () => {
            const text = noteInput.value.trim();
            if (!text) return;
            const r = await fetch("/api/tickets/" + ticket.id + "/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ author: user.name, text }) });
            if (r.ok) {
                const n = await r.json();
                ticket.internalNotes = ticket.internalNotes || [];
                ticket.internalNotes.push(n);
                renderMessages(noteList, ticket.internalNotes, "#fff8f0");
                noteInput.value = "";
                card.querySelector(".note-block strong").textContent = "🔒 Internal Notes (" + ticket.internalNotes.length + ")";
            }
        });

        requestList.appendChild(card);
    });
}

function renderMessages(container, items, bg) {
    const background = bg || "#f5f5f5";
    if (!items || items.length === 0) {
        container.innerHTML = "<p style='color:#888;font-size:13px;margin:0'>None yet.</p>";
        return;
    }
    container.innerHTML = "";
    items.forEach(function (c) {
        const div = document.createElement("div");
        div.style.cssText = `background:${background};border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px`;
        const header = document.createElement("div");
        header.style.cssText = "font-weight:bold;margin-bottom:2px;color:#333";
        header.textContent = c.author + " · " + new Date(c.createdAt).toLocaleString();
        const body = document.createElement("div");
        body.textContent = c.text;
        div.appendChild(header);
        div.appendChild(body);
        container.appendChild(div);
    });
}

// ---------- Users ----------

async function loadUsers() {
    const res = await fetch("/api/users");
    const users = await res.json();
    staffUsers = users.filter(u => u.role === "admin");
    userList.innerHTML = "";
    users.forEach(function (u) {
        const item = document.createElement("li");
        item.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee";
        const span = document.createElement("span");
        span.textContent = u.name + " (" + u.email + ") — " + u.role;
        const del = document.createElement("button");
        del.textContent = "Delete";
        del.style.cssText = "padding:2px 10px;font-size:13px;border:1px solid #cc0000;color:#cc0000;background:transparent;border-radius:4px;cursor:pointer";
        del.addEventListener("click", async () => {
            if (!confirm("Delete " + u.name + "? This cannot be undone.")) return;
            const r = await fetch("/api/users/" + u.id, { method: "DELETE" });
            if (r.ok) loadUsers();
        });
        item.appendChild(span);
        if (u.id !== 1) item.appendChild(del);
        userList.appendChild(item);
    });
}

userForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorMessage.textContent = "";
    successMessage.textContent = "";

    const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value,
            role: document.getElementById("role").value
        })
    });

    const result = await response.json();
    if (!response.ok) { errorMessage.textContent = result.error; return; }
    successMessage.textContent = result.name + " was added.";
    userForm.reset();
    loadUsers();
});

["search", "filter-status", "filter-priority", "filter-category", "sort-by"].forEach(function (id) {
    const el = document.getElementById(id);
    el.addEventListener("input", () => { currentPage = 1; renderTickets(); });
    el.addEventListener("change", () => { currentPage = 1; renderTickets(); });
});

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

if (user && user.role === "admin") {
    loadStaff().then(() => loadTickets());
    loadUsers();
}
