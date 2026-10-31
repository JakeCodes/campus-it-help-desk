var user = JSON.parse(localStorage.getItem("user"));
if (!user || user.role !== "admin") window.location.href = "login.html";

var requestList  = document.getElementById("request-list");
var userList     = document.getElementById("user-list");
var userForm     = document.getElementById("userForm");
var errorMessage = document.getElementById("errorMessage");
var successMessage = document.getElementById("successMessage");
var paginationEl = document.getElementById("pagination");

var STATUSES        = ["Open", "In Progress", "Resolved"];
var PRIORITY_ORDER  = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
var PRIORITY_COLORS = { Low: "#6c757d", Medium: "#0066cc", High: "#e67e00", Urgent: "#cc0000" };
var PAGE_SIZE = 10;
var currentPage   = 1;
var allTickets    = [];
var staffUsers    = [];
var selectedTickets = new Set();
var statusChart   = null;
var categoryChart = null;
var chartsVisible = false;

// ---------- Dark mode ----------

function toggleDark() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    document.getElementById("dark-toggle").textContent = isDark ? "Dark Mode" : "Light Mode";
    if (chartsVisible) renderCharts(allTickets);
}

(function () {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    document.getElementById("dark-toggle").textContent = isDark ? "Light Mode" : "Dark Mode";
})();

// ---------- Charts ----------

function toggleCharts() {
    chartsVisible = !chartsVisible;
    var card = document.getElementById("charts-card");
    var btn  = document.getElementById("charts-toggle-btn");
    if (chartsVisible) {
        card.classList.add("visible");
        btn.textContent = "Hide Charts";
        renderCharts(allTickets);
    } else {
        card.classList.remove("visible");
        btn.textContent = "Show Charts";
    }
}

function renderCharts(tickets) {
    var isDark    = document.documentElement.getAttribute("data-theme") === "dark";
    var textColor = isDark ? "#e0e0e0" : "#333333";
    var gridColor = isDark ? "#3a3a3a" : "#dddddd";

    // Status donut
    var sCounts = { Open: 0, "In Progress": 0, Resolved: 0 };
    tickets.forEach(function (t) { sCounts[t.status] = (sCounts[t.status] || 0) + 1; });
    var sCtx = document.getElementById("chart-status").getContext("2d");
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(sCtx, {
        type: "doughnut",
        data: {
            labels: ["Open", "In Progress", "Resolved"],
            datasets: [{
                data: [sCounts.Open, sCounts["In Progress"], sCounts.Resolved],
                backgroundColor: ["#cc0000", "#e67e00", "#1a7f37"],
                borderWidth: 2,
                borderColor: isDark ? "#1e1e1e" : "#ffffff"
            }]
        },
        options: {
            plugins: {
                legend: { position: "bottom", labels: { color: textColor, font: { size: 12 } } }
            }
        }
    });

    // Category bar
    var catCounts = {};
    tickets.forEach(function (t) { catCounts[t.category] = (catCounts[t.category] || 0) + 1; });
    var cCtx = document.getElementById("chart-category").getContext("2d");
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(cCtx, {
        type: "bar",
        data: {
            labels: Object.keys(catCounts),
            datasets: [{
                label: "Tickets",
                data: Object.values(catCounts),
                backgroundColor: isDark ? "#4d9cf0" : "#0066cc",
                borderRadius: 4
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } },
                y: { beginAtZero: true, ticks: { stepSize: 1, color: textColor }, grid: { color: gridColor } }
            }
        }
    });
}

// ---------- Stats ----------

function updateStats() {
    document.getElementById("count-all").textContent      = allTickets.length;
    document.getElementById("count-open").textContent     = allTickets.filter(function (t) { return t.status === "Open"; }).length;
    document.getElementById("count-progress").textContent = allTickets.filter(function (t) { return t.status === "In Progress"; }).length;
    document.getElementById("count-resolved").textContent = allTickets.filter(function (t) { return t.status === "Resolved"; }).length;
    if (chartsVisible) renderCharts(allTickets);
}

function filterByStat(status) {
    document.getElementById("filter-status").value = status;
    currentPage = 1;
    renderTickets();
}

// ---------- Filters & sort ----------

function getFilters() {
    return {
        search:   document.getElementById("search").value.trim(),
        status:   document.getElementById("filter-status").value,
        priority: document.getElementById("filter-priority").value,
        category: document.getElementById("filter-category").value,
        sort:     document.getElementById("sort-by").value
    };
}

function applyFiltersAndSort() {
    var f = getFilters();
    var searchLower = f.search.toLowerCase();
    var idSearch = /^#?(\d+)$/.test(f.search) ? parseInt(f.search.replace("#", ""), 10) : null;

    var list = allTickets.filter(function (t) {
        if (f.status   && t.status   !== f.status)   return false;
        if (f.priority && t.priority !== f.priority) return false;
        if (f.category && t.category !== f.category) return false;
        if (f.search) {
            if (idSearch !== null) {
                return t.id === idSearch;
            }
            return t.title.toLowerCase().includes(searchLower) ||
                   t.studentName.toLowerCase().includes(searchLower) ||
                   t.description.toLowerCase().includes(searchLower);
        }
        return true;
    });

    list.sort(function (a, b) {
        var s = f.sort;
        if (s === "date-asc")       return new Date(a.createdAt) - new Date(b.createdAt);
        if (s === "date-desc")      return new Date(b.createdAt) - new Date(a.createdAt);
        if (s === "priority-desc")  return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
        if (s === "priority-asc")   return (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0);
        if (s === "status")         return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return list;
}

// ---------- Pagination ----------

function renderPagination(total) {
    var totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) { paginationEl.innerHTML = ""; return; }
    var start = (currentPage - 1) * PAGE_SIZE + 1;
    var end   = Math.min(currentPage * PAGE_SIZE, total);
    paginationEl.innerHTML =
        '<span class="page-info">Showing ' + start + '–' + end + ' of ' + total + '</span>' +
        '<button class="btn btn-outline page-btn" ' + (currentPage === 1 ? "disabled" : "") + ' onclick="changePage(-1)">&#8592; Prev</button>' +
        '<span class="page-num">Page ' + currentPage + ' of ' + totalPages + '</span>' +
        '<button class="btn btn-outline page-btn" ' + (currentPage === totalPages ? "disabled" : "") + ' onclick="changePage(1)">Next &#8594;</button>';
}

function changePage(delta) {
    currentPage += delta;
    renderTickets();
    window.scrollTo(0, 0);
}

// ---------- CSV Export ----------

function exportCSV() {
    var filtered = applyFiltersAndSort();
    var headers  = ["ID","Title","Student","Email","Category","Priority","Status","Assigned To","Due Date","Created","Last Updated","Description"];
    var rows = filtered.map(function (t) {
        return [
            t.id,
            '"' + (t.title        || "").replace(/"/g, '""') + '"',
            '"' + (t.studentName  || "").replace(/"/g, '""') + '"',
            t.studentEmail || "",
            t.category     || "",
            t.priority     || "",
            t.status       || "",
            t.assignedTo   || "",
            t.dueDate      || "",
            t.createdAt  ? new Date(t.createdAt).toLocaleDateString()  : "",
            t.updatedAt  ? new Date(t.updatedAt).toLocaleDateString()  : "",
            '"' + (t.description  || "").replace(/"/g, '""').replace(/\n/g, " ") + '"'
        ].join(",");
    });
    var csv  = [headers.join(",")].concat(rows).join("\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement("a");
    a.href   = url;
    a.download = "tickets-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
}

// ---------- Bulk actions ----------

function updateBulkBar() {
    var bar   = document.getElementById("bulk-bar");
    var count = selectedTickets.size;
    if (count > 0) {
        bar.style.display = "flex";
        document.getElementById("bulk-count").textContent = count + " selected";
    } else {
        bar.style.display = "none";
    }
}

function clearBulk() {
    selectedTickets.clear();
    document.querySelectorAll(".ticket-checkbox").forEach(function (cb) { cb.checked = false; });
    updateBulkBar();
}

function bulkSetStatus() {
    var value = document.getElementById("bulk-status-sel").value;
    if (!value) { alert("Select a status first."); return; }
    var ids = Array.from(selectedTickets);
    fetch("/api/tickets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", ticketIds: ids, value: value })
    }).then(function (r) {
        if (r.ok) {
            ids.forEach(function (id) {
                var t = allTickets.find(function (x) { return x.id === id; });
                if (t) t.status = value;
            });
            clearBulk();
            updateStats();
            renderTickets();
        }
    });
}

function bulkAssign() {
    var value = document.getElementById("bulk-assign-sel").value;
    var ids   = Array.from(selectedTickets);
    fetch("/api/tickets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", ticketIds: ids, value: value || null })
    }).then(function (r) {
        if (r.ok) {
            ids.forEach(function (id) {
                var t = allTickets.find(function (x) { return x.id === id; });
                if (t) t.assignedTo = value || null;
            });
            clearBulk();
            renderTickets();
        }
    });
}

function bulkDelete() {
    var ids = Array.from(selectedTickets);
    if (!confirm("Delete " + ids.length + " ticket(s)? This cannot be undone.")) return;
    fetch("/api/tickets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ticketIds: ids })
    }).then(function (r) {
        if (r.ok) {
            allTickets = allTickets.filter(function (t) { return !ids.includes(t.id); });
            clearBulk();
            updateStats();
            renderTickets();
        }
    });
}

// ---------- Load ----------

async function loadTickets() {
    var res = await fetch("/api/tickets");
    allTickets = await res.json();
    updateStats();
    renderTickets();
}

async function loadStaff() {
    var res   = await fetch("/api/users");
    var users = await res.json();
    staffUsers = users.filter(function (u) { return u.role === "admin"; });
    var bulkSel = document.getElementById("bulk-assign-sel");
    bulkSel.innerHTML = '<option value="">Assign to...</option>';
    staffUsers.forEach(function (s) {
        var opt = document.createElement("option");
        opt.value = s.name; opt.textContent = s.name;
        bulkSel.appendChild(opt);
    });
    var unopt = document.createElement("option");
    unopt.value = ""; unopt.textContent = "Unassigned";
    bulkSel.appendChild(unopt);
}

// ---------- Render tickets ----------

function renderTickets() {
    var filtered   = applyFiltersAndSort();
    var totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    var page = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    renderPagination(filtered.length);

    if (page.length === 0) {
        requestList.innerHTML = "<p style='padding:12px;color:var(--text)'>No tickets match your filters.</p>";
        return;
    }

    requestList.innerHTML = "";
    page.forEach(function (ticket) {
        var card          = document.createElement("div");
        var priorityColor = PRIORITY_COLORS[ticket.priority] || "#6c757d";
        var comments      = ticket.comments      || [];
        var notes         = ticket.internalNotes || [];
        var history       = ticket.history       || [];

        var assignOptions = staffUsers.map(function (s) {
            return '<option value="' + s.name + '" ' + (ticket.assignedTo === s.name ? "selected" : "") + '>' + s.name + '</option>';
        }).join("");

        var isImage    = ticket.attachment && /\.(png|jpg|jpeg|gif|webp)$/i.test(ticket.attachment.name);
        var attachHtml = ticket.attachment ? (
            isImage
                ? '<div style="margin-top:8px"><a href="' + ticket.attachment.url + '" target="_blank"><img src="' + ticket.attachment.url + '" alt="' + ticket.attachment.name + '" style="max-width:100%;max-height:160px;border-radius:4px;border:1px solid var(--border)"></a></div>'
                : '<div style="margin-top:8px"><a href="' + ticket.attachment.url + '" target="_blank" style="color:var(--primary)">Attachment: ' + ticket.attachment.name + '</a></div>'
        ) : "";

        var now      = new Date();
        var dueDate  = ticket.dueDate ? new Date(ticket.dueDate + "T23:59:59") : null;
        var isOverdue = dueDate && dueDate < now && ticket.status !== "Resolved";
        var overdueHtml = isOverdue ? '<span class="overdue-label">OVERDUE</span>' : "";

        var updatedText = ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : "";

        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">' +
                '<label style="display:flex;align-items:center;gap:8px;flex:1;margin-right:8px;cursor:pointer">' +
                    '<input type="checkbox" class="ticket-checkbox" value="' + ticket.id + '">' +
                    '<h3 style="margin:0;font-size:15px;color:var(--text)"></h3>' +
                '</label>' +
                '<span class="priority-badge" style="background:' + priorityColor + '"></span>' +
            '</div>' +
            '<p style="margin:2px 0;font-size:12px;color:var(--text-faint)">Ticket #' + ticket.id + (updatedText ? ' · Updated: ' + updatedText : '') + '</p>' +
            '<p style="margin:4px 0"><strong>From:</strong> <span class="from"></span></p>' +
            '<p style="margin:4px 0"><strong>Category:</strong> <span class="category"></span></p>' +
            '<p style="margin:4px 0"><strong>Submitted:</strong> <span class="created"></span></p>' +
            '<p style="margin:4px 0"><strong>Due:</strong> <input type="date" class="due-input" value="' + (ticket.dueDate || "") + '"> ' + overdueHtml + '</p>' +
            '<p class="desc" style="margin:8px 0;color:var(--text-muted)"></p>' +
            attachHtml +
            '<p style="margin:6px 0"><strong>Status:</strong> <select class="status-sel ticket-inline-select"></select></p>' +
            '<p style="margin:6px 0"><strong>Assigned to:</strong>' +
                '<select class="assign-sel ticket-inline-select">' +
                    '<option value="">Unassigned</option>' + assignOptions +
                '</select>' +
            '</p>' +
            '<div style="margin-top:12px;display:flex;justify-content:flex-end">' +
                '<button class="btn delete-btn" style="padding:4px 12px;font-size:13px;border-color:var(--error);color:var(--error);background:transparent">Delete Ticket</button>' +
            '</div>' +

            '<div class="comment-block" style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px">' +
                '<strong style="color:var(--text)">Student-visible Comments (<span class="comment-count">' + comments.length + '</span>)</strong>' +
                '<div class="comment-list" style="margin:8px 0"></div>' +
                '<div style="display:flex;gap:8px;margin-top:6px">' +
                    '<input class="comment-input ticket-inline-input" type="text" placeholder="Add comment (visible to student)...">' +
                    '<button class="comment-btn btn btn-primary" style="padding:6px 12px;font-size:13px">Send</button>' +
                '</div>' +
            '</div>' +

            '<div class="note-block" style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px">' +
                '<strong style="color:#8b4513">Internal Notes (<span class="note-count">' + notes.length + '</span>)</strong>' +
                '<div class="note-list" style="margin:8px 0"></div>' +
                '<div style="display:flex;gap:8px;margin-top:6px">' +
                    '<input class="note-input ticket-inline-input" type="text" placeholder="Add private note (staff only)...">' +
                    '<button class="note-btn btn" style="padding:6px 12px;font-size:13px;background:#8b4513;color:#fff;border-color:#8b4513">Add</button>' +
                '</div>' +
            '</div>' +

            '<details class="history-section">' +
                '<summary>History (' + history.length + ')</summary>' +
                '<div class="history-list" style="margin-top:8px"></div>' +
            '</details>';

        card.querySelector("h3").textContent           = ticket.title;
        card.querySelector(".priority-badge").textContent = ticket.priority || "Medium";
        card.querySelector(".from").textContent        = ticket.studentName;
        card.querySelector(".category").textContent    = ticket.category;
        card.querySelector(".created").textContent     = new Date(ticket.createdAt).toLocaleDateString();
        card.querySelector(".desc").textContent        = ticket.description;

        // Checkbox
        var checkbox = card.querySelector(".ticket-checkbox");
        checkbox.checked = selectedTickets.has(ticket.id);
        checkbox.addEventListener("change", function () {
            if (this.checked) selectedTickets.add(ticket.id);
            else              selectedTickets.delete(ticket.id);
            updateBulkBar();
        });

        // Due date
        var dueInput = card.querySelector(".due-input");
        dueInput.addEventListener("change", function () {
            var val = this.value || null;
            fetch("/api/tickets/" + ticket.id, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dueDate: val, changedBy: user.name })
            }).then(function (r) { return r.json(); }).then(function (updated) {
                var t = allTickets.find(function (x) { return x.id === ticket.id; });
                if (t) { t.dueDate = val; t.updatedAt = updated.updatedAt; }
            });
        });

        // Status select
        var statusSel = card.querySelector(".status-sel");
        STATUSES.forEach(function (s) {
            var opt = document.createElement("option");
            opt.value = s; opt.textContent = s;
            opt.selected = s === ticket.status;
            statusSel.appendChild(opt);
        });
        statusSel.addEventListener("change", function () {
            fetch("/api/tickets/" + ticket.id, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: statusSel.value, changedBy: user.name })
            }).then(function (r) { return r.json(); }).then(function (updated) {
                var t = allTickets.find(function (x) { return x.id === ticket.id; });
                if (t) { t.status = statusSel.value; t.updatedAt = updated.updatedAt; }
                updateStats();
            });
        });

        // Assign select
        var assignSel = card.querySelector(".assign-sel");
        assignSel.addEventListener("change", function () {
            fetch("/api/tickets/" + ticket.id, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignedTo: assignSel.value || null, changedBy: user.name })
            }).then(function (r) { return r.json(); }).then(function (updated) {
                var t = allTickets.find(function (x) { return x.id === ticket.id; });
                if (t) { t.assignedTo = assignSel.value || null; t.updatedAt = updated.updatedAt; }
            });
        });

        // Delete
        card.querySelector(".delete-btn").addEventListener("click", async function () {
            if (!confirm("Delete this ticket? This cannot be undone.")) return;
            var r = await fetch("/api/tickets/" + ticket.id, { method: "DELETE" });
            if (r.ok) {
                allTickets = allTickets.filter(function (x) { return x.id !== ticket.id; });
                selectedTickets.delete(ticket.id);
                updateBulkBar();
                updateStats();
                renderTickets();
            }
        });

        // Comments
        var commentList  = card.querySelector(".comment-list");
        var commentInput = card.querySelector(".comment-input");
        renderMessages(commentList, comments, false);
        card.querySelector(".comment-btn").addEventListener("click", async function () {
            var text = commentInput.value.trim();
            if (!text) return;
            var r = await fetch("/api/tickets/" + ticket.id + "/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ author: user.name, text: text, fromStudent: false })
            });
            if (r.ok) {
                var c = await r.json();
                ticket.comments = ticket.comments || [];
                ticket.comments.push(c);
                renderMessages(commentList, ticket.comments, false);
                commentInput.value = "";
                card.querySelector(".comment-count").textContent = ticket.comments.length;
            }
        });
        commentInput.addEventListener("keydown", function (e) { if (e.key === "Enter") card.querySelector(".comment-btn").click(); });

        // Notes
        var noteList  = card.querySelector(".note-list");
        var noteInput = card.querySelector(".note-input");
        renderMessages(noteList, notes, true);
        card.querySelector(".note-btn").addEventListener("click", async function () {
            var text = noteInput.value.trim();
            if (!text) return;
            var r = await fetch("/api/tickets/" + ticket.id + "/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ author: user.name, text: text })
            });
            if (r.ok) {
                var n = await r.json();
                ticket.internalNotes = ticket.internalNotes || [];
                ticket.internalNotes.push(n);
                renderMessages(noteList, ticket.internalNotes, true);
                noteInput.value = "";
                card.querySelector(".note-count").textContent = ticket.internalNotes.length;
            }
        });
        noteInput.addEventListener("keydown", function (e) { if (e.key === "Enter") card.querySelector(".note-btn").click(); });

        // History
        renderHistory(card.querySelector(".history-list"), history);

        requestList.appendChild(card);
    });
}

function renderMessages(container, items, isNote) {
    if (!items || items.length === 0) {
        container.innerHTML = "<p style='color:var(--text-faint);font-size:13px;margin:0'>None yet.</p>";
        return;
    }
    container.innerHTML = "";
    items.forEach(function (c) {
        var div = document.createElement("div");
        var isFromStudent = c.fromStudent;
        if (isNote) {
            div.style.cssText = "background:var(--note-bg);border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px;border-left:3px solid #8b4513";
        } else if (isFromStudent) {
            div.style.cssText = "background:var(--primary-light);border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px;border-left:3px solid var(--primary)";
        } else {
            div.style.cssText = "background:var(--msg-bg);border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px";
        }
        var header = document.createElement("div");
        header.style.cssText = "font-weight:bold;margin-bottom:2px;color:var(--text-muted);font-size:12px";
        header.textContent = c.author + (isFromStudent ? " [Student]" : "") + " · " + new Date(c.createdAt).toLocaleString();
        var body = document.createElement("div");
        body.style.color = "var(--text)";
        body.textContent = c.text;
        div.appendChild(header);
        div.appendChild(body);
        container.appendChild(div);
    });
}

function renderHistory(container, history) {
    if (!history || history.length === 0) {
        container.innerHTML = "<p style='color:var(--text-faint);font-size:12px;margin:4px 0'>No history yet.</p>";
        return;
    }
    container.innerHTML = "";
    history.slice().reverse().forEach(function (entry) {
        var div = document.createElement("div");
        div.className = "history-entry";
        div.textContent = new Date(entry.at).toLocaleString() + " — " + entry.by + ": " + entry.action;
        container.appendChild(div);
    });
}

// ---------- Users ----------

async function loadUsers() {
    var res   = await fetch("/api/users");
    var users = await res.json();
    staffUsers = users.filter(function (u) { return u.role === "admin"; });
    userList.innerHTML = "";
    users.forEach(function (u) {
        var item = document.createElement("li");
        item.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)";
        var span = document.createElement("span");
        span.textContent = u.name + " (" + u.email + ") — " + u.role;
        span.style.color = "var(--text)";
        var del = document.createElement("button");
        del.textContent = "Delete";
        del.style.cssText = "padding:2px 10px;font-size:13px;border:1px solid var(--error);color:var(--error);background:transparent;border-radius:4px;cursor:pointer";
        del.addEventListener("click", async function () {
            if (!confirm("Delete " + u.name + "? This cannot be undone.")) return;
            var r = await fetch("/api/users/" + u.id, { method: "DELETE" });
            if (r.ok) loadUsers();
        });
        item.appendChild(span);
        if (u.id !== 1) item.appendChild(del);
        userList.appendChild(item);
    });
}

userForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorMessage.textContent   = "";
    successMessage.textContent = "";
    var response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name:     document.getElementById("name").value.trim(),
            email:    document.getElementById("email").value.trim(),
            password: document.getElementById("password").value,
            role:     document.getElementById("role").value
        })
    });
    var result = await response.json();
    if (!response.ok) { errorMessage.textContent = result.error; return; }
    successMessage.textContent = result.name + " was added.";
    userForm.reset();
    loadUsers();
});

["search", "filter-status", "filter-priority", "filter-category", "sort-by"].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener("input",  function () { currentPage = 1; renderTickets(); });
    el.addEventListener("change", function () { currentPage = 1; renderTickets(); });
});

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

if (user && user.role === "admin") {
    loadStaff().then(function () { loadTickets(); });
    loadUsers();
}
