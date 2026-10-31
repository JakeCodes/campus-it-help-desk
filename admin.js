var user = JSON.parse(localStorage.getItem("user"));
if (!user || user.role !== "admin") window.location.href = "login.html";

var requestList    = document.getElementById("request-list");
var userList       = document.getElementById("user-list");
var userForm       = document.getElementById("userForm");
var errorMessage   = document.getElementById("errorMessage");
var successMessage = document.getElementById("successMessage");
var paginationEl   = document.getElementById("pagination");

var STATUSES        = ["Open", "In Progress", "Resolved"];
var PRIORITY_ORDER  = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
var PRIORITY_COLORS = { Low: "#6c757d", Medium: "#0066cc", High: "#e67e00", Urgent: "#cc0000" };
var PAGE_SIZE = 10;
var currentPage     = 1;
var allTickets      = [];
var staffUsers      = [];
var allTags         = [];
var allQuickReplies = [];
var selectedTickets = new Set();
var statusChart     = null;
var categoryChart   = null;
var chartsVisible   = false;
var statsVisible    = false;
var kbEditId        = null;

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

    var sCounts = { Open: 0, "In Progress": 0, Resolved: 0 };
    tickets.forEach(function (t) { sCounts[t.status] = (sCounts[t.status] || 0) + 1; });
    var sCtx = document.getElementById("chart-status").getContext("2d");
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(sCtx, {
        type: "doughnut",
        data: {
            labels: ["Open", "In Progress", "Resolved"],
            datasets: [{ data: [sCounts.Open, sCounts["In Progress"], sCounts.Resolved], backgroundColor: ["#cc0000", "#e67e00", "#1a7f37"], borderWidth: 2, borderColor: isDark ? "#1e1e1e" : "#ffffff" }]
        },
        options: { plugins: { legend: { position: "bottom", labels: { color: textColor, font: { size: 12 } } } } }
    });

    var catCounts = {};
    tickets.forEach(function (t) { catCounts[t.category] = (catCounts[t.category] || 0) + 1; });
    var cCtx = document.getElementById("chart-category").getContext("2d");
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(cCtx, {
        type: "bar",
        data: {
            labels: Object.keys(catCounts),
            datasets: [{ label: "Tickets", data: Object.values(catCounts), backgroundColor: isDark ? "#4d9cf0" : "#0066cc", borderRadius: 4 }]
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

// ---------- Staff stats ----------

function toggleStaffStats() {
    statsVisible = !statsVisible;
    var card = document.getElementById("staff-stats-card");
    var btn  = document.getElementById("stats-toggle-btn");
    if (statsVisible) {
        card.classList.add("visible");
        btn.textContent = "Hide Stats";
        renderStaffStats();
    } else {
        card.classList.remove("visible");
        btn.textContent = "Staff Stats";
    }
}

function renderStaffStats() {
    var body = document.getElementById("staff-stats-body");
    var staffMap = {};
    allTickets.forEach(function (t) {
        var name = t.assignedTo || "Unassigned";
        if (!staffMap[name]) staffMap[name] = { open: 0, resolved: 0, total: 0, totalHrs: 0, ratings: [] };
        staffMap[name].total++;
        if (t.status === "Resolved") staffMap[name].resolved++;
        else staffMap[name].open++;
        (t.timeLog || []).forEach(function (e) { staffMap[name].totalHrs += e.hours; });
        if (t.rating) staffMap[name].ratings.push(t.rating.stars);
    });

    var rows = Object.keys(staffMap).sort().map(function (name) {
        var s = staffMap[name];
        var avgRating = s.ratings.length ? (s.ratings.reduce(function(a,b){ return a+b; },0)/s.ratings.length).toFixed(1) : "—";
        return '<tr><td>' + name + '</td><td>' + s.total + '</td><td style="color:var(--error)">' + s.open + '</td><td style="color:var(--success)">' + s.resolved + '</td><td>' + s.totalHrs.toFixed(1) + 'h</td><td>' + (s.ratings.length ? avgRating + "★" : "—") + '</td></tr>';
    }).join("");

    body.innerHTML = rows
        ? '<table class="stats-table"><thead><tr><th>Staff Member</th><th>Total</th><th>Open</th><th>Resolved</th><th>Time Logged</th><th>Avg Rating</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<p style="font-size:13px;color:var(--text-muted)">No ticket data yet.</p>';
}

// ---------- Stats bar ----------

function updateStats() {
    document.getElementById("count-all").textContent      = allTickets.length;
    document.getElementById("count-open").textContent     = allTickets.filter(function (t) { return t.status === "Open"; }).length;
    document.getElementById("count-progress").textContent = allTickets.filter(function (t) { return t.status === "In Progress"; }).length;
    document.getElementById("count-resolved").textContent = allTickets.filter(function (t) { return t.status === "Resolved"; }).length;
    if (chartsVisible) renderCharts(allTickets);
    if (statsVisible)  renderStaffStats();
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
            if (idSearch !== null) return t.id === idSearch;
            return t.title.toLowerCase().includes(searchLower) ||
                   t.studentName.toLowerCase().includes(searchLower) ||
                   t.description.toLowerCase().includes(searchLower);
        }
        return true;
    });

    list.sort(function (a, b) {
        var s = f.sort;
        if (s === "date-asc")      return new Date(a.createdAt) - new Date(b.createdAt);
        if (s === "date-desc")     return new Date(b.createdAt) - new Date(a.createdAt);
        if (s === "priority-desc") return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
        if (s === "priority-asc")  return (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0);
        if (s === "status")        return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return list;
}

// ---------- Saved views ----------

function getSavedViews() {
    try { return JSON.parse(localStorage.getItem("savedViews") || "[]"); } catch { return []; }
}

function saveCurrentView() {
    var name = prompt("Name for this saved view:");
    if (!name || !name.trim()) return;
    var f = getFilters();
    var views = getSavedViews();
    views.push({ name: name.trim(), filters: f });
    localStorage.setItem("savedViews", JSON.stringify(views));
    renderSavedViews();
}

function applyView(filters) {
    document.getElementById("search").value          = filters.search   || "";
    document.getElementById("filter-status").value   = filters.status   || "";
    document.getElementById("filter-priority").value = filters.priority || "";
    document.getElementById("filter-category").value = filters.category || "";
    document.getElementById("sort-by").value         = filters.sort     || "date-desc";
    currentPage = 1;
    renderTickets();
}

function deleteView(idx) {
    var views = getSavedViews();
    views.splice(idx, 1);
    localStorage.setItem("savedViews", JSON.stringify(views));
    renderSavedViews();
}

function renderSavedViews() {
    var bar   = document.getElementById("saved-views-bar");
    var views = getSavedViews();
    if (views.length === 0) { bar.innerHTML = ""; return; }
    bar.innerHTML = '<span style="font-size:12px;color:var(--text-muted);margin-right:4px">Saved views:</span>';
    views.forEach(function (v, i) {
        var btn = document.createElement("button");
        btn.className = "saved-view-btn";
        btn.textContent = v.name;
        btn.addEventListener("click", function () { applyView(v.filters); });
        var del = document.createElement("span");
        del.textContent = " ×";
        del.style.cssText = "cursor:pointer;margin-left:2px;opacity:0.6";
        del.addEventListener("click", function (e) { e.stopPropagation(); deleteView(i); });
        btn.appendChild(del);
        bar.appendChild(btn);
    });
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

// ---------- CSV export ----------

function exportCSV() {
    var filtered = applyFiltersAndSort();
    var headers  = ["ID","Title","Student","Email","Category","Priority","Status","Assigned To","Due Date","Created","Last Updated","Description"];
    var rows = filtered.map(function (t) {
        return [
            t.id,
            '"' + (t.title       || "").replace(/"/g,'""') + '"',
            '"' + (t.studentName || "").replace(/"/g,'""') + '"',
            t.studentEmail || "", t.category || "", t.priority || "", t.status || "",
            t.assignedTo   || "", t.dueDate  || "",
            t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "",
            t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : "",
            '"' + (t.description || "").replace(/"/g,'""').replace(/\n/g," ") + '"'
        ].join(",");
    });
    var csv  = [headers.join(",")].concat(rows).join("\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement("a");
    a.href   = url;
    a.download = "tickets-" + new Date().toISOString().slice(0,10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
}

// ---------- Bulk actions ----------

function updateBulkBar() {
    var bar = document.getElementById("bulk-bar");
    var count = selectedTickets.size;
    if (count > 0) { bar.style.display = "flex"; document.getElementById("bulk-count").textContent = count + " selected"; }
    else             bar.style.display = "none";
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
    fetch("/api/tickets/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", ticketIds: ids, value: value }) })
        .then(function (r) {
            if (r.ok) { ids.forEach(function (id) { var t = allTickets.find(function (x) { return x.id === id; }); if (t) t.status = value; }); clearBulk(); updateStats(); renderTickets(); }
        });
}

function bulkAssign() {
    var value = document.getElementById("bulk-assign-sel").value;
    var ids   = Array.from(selectedTickets);
    fetch("/api/tickets/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", ticketIds: ids, value: value || null }) })
        .then(function (r) {
            if (r.ok) { ids.forEach(function (id) { var t = allTickets.find(function (x) { return x.id === id; }); if (t) t.assignedTo = value || null; }); clearBulk(); renderTickets(); }
        });
}

function bulkDelete() {
    var ids = Array.from(selectedTickets);
    if (!confirm("Delete " + ids.length + " ticket(s)? This cannot be undone.")) return;
    fetch("/api/tickets/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", ticketIds: ids }) })
        .then(function (r) {
            if (r.ok) { allTickets = allTickets.filter(function (t) { return !ids.includes(t.id); }); clearBulk(); updateStats(); renderTickets(); }
        });
}

// ---------- Announcement ----------

function loadAnnouncement() {
    fetch("/api/announcement").then(function(r){ return r.json(); }).then(function(data){
        var bar = document.getElementById("announcement-bar");
        if (data.announcement && data.announcement.active) {
            document.getElementById("announcement-text").textContent = data.announcement.text;
            bar.style.display = "flex";
            var ta = document.getElementById("ann-text");
            if (ta) ta.value = data.announcement.text;
        } else {
            bar.style.display = "none";
        }
    });
}

function saveAnnouncement() {
    var text = document.getElementById("ann-text").value.trim();
    if (!text) { alert("Enter announcement text."); return; }
    fetch("/api/announcement", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text, active: true, by: user.name }) })
        .then(function(){ document.getElementById("ann-msg").textContent = "Announcement posted!"; loadAnnouncement(); setTimeout(function(){ document.getElementById("ann-msg").textContent = ""; }, 2500); });
}

function clearAnnouncement() {
    fetch("/api/announcement", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "", active: false }) })
        .then(function(){ document.getElementById("ann-text").value = ""; document.getElementById("announcement-bar").style.display = "none"; document.getElementById("ann-msg").textContent = "Announcement cleared."; setTimeout(function(){ document.getElementById("ann-msg").textContent = ""; }, 2500); });
}

// ---------- Quick replies ----------

function loadQuickReplies() {
    fetch("/api/quickreplies").then(function(r){ return r.json(); }).then(function(list){
        allQuickReplies = list;
        renderQrList();
    });
}

function renderQrList() {
    var ul = document.getElementById("qr-list");
    if (!ul) return;
    if (allQuickReplies.length === 0) { ul.innerHTML = '<li style="color:var(--text-muted)">No templates yet.</li>'; return; }
    ul.innerHTML = "";
    allQuickReplies.forEach(function(qr){
        var li = document.createElement("li");
        li.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)";
        var span = document.createElement("span");
        span.textContent = qr.text;
        span.style.color = "var(--text)";
        var del = document.createElement("button");
        del.textContent = "Delete";
        del.style.cssText = "padding:2px 8px;font-size:12px;border:1px solid var(--error);color:var(--error);background:transparent;border-radius:4px;cursor:pointer";
        del.addEventListener("click", function(){
            fetch("/api/quickreplies/" + qr.id, { method: "DELETE" }).then(function(){ loadQuickReplies(); });
        });
        li.appendChild(span);
        li.appendChild(del);
        ul.appendChild(li);
    });
}

function addQuickReply() {
    var text = document.getElementById("qr-input").value.trim();
    if (!text) return;
    fetch("/api/quickreplies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text }) })
        .then(function(){ document.getElementById("qr-input").value = ""; loadQuickReplies(); });
}

// ---------- Tags ----------

function loadTags() {
    fetch("/api/tags").then(function(r){ return r.json(); }).then(function(list){
        allTags = list;
        renderTagsMgmt();
    });
}

function renderTagsMgmt() {
    var container = document.getElementById("tags-list");
    if (!container) return;
    if (allTags.length === 0) { container.innerHTML = '<span style="font-size:13px;color:var(--text-muted)">No tags yet.</span>'; return; }
    container.innerHTML = "";
    allTags.forEach(function(tag){
        var pill = document.createElement("span");
        pill.className = "tag-pill";
        pill.style.background = tag.color;
        pill.textContent = tag.name;
        var del = document.createElement("span");
        del.className = "tag-remove";
        del.textContent = "×";
        del.title = "Delete tag";
        del.addEventListener("click", function(){
            if (!confirm('Delete tag "' + tag.name + '"? It will be removed from all tickets.')) return;
            fetch("/api/tags/" + tag.id, { method: "DELETE" }).then(function(){ loadTags(); allTickets.forEach(function(t){ if (t.tags) t.tags = t.tags.filter(function(id){ return id !== tag.id; }); }); renderTickets(); });
        });
        pill.appendChild(del);
        container.appendChild(pill);
    });
}

function addTag() {
    var name  = document.getElementById("tag-name-input").value.trim();
    var color = document.getElementById("tag-color-input").value;
    if (!name) return;
    fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name, color: color }) })
        .then(function(){ document.getElementById("tag-name-input").value = ""; loadTags(); });
}

// ---------- Knowledge base ----------

function loadKB() {
    fetch("/api/kb").then(function(r){ return r.json(); }).then(function(list){ renderKBList(list); });
}

function renderKBList(articles) {
    var ul = document.getElementById("kb-list");
    if (!ul) return;
    if (!articles || articles.length === 0) { ul.innerHTML = '<li style="color:var(--text-muted)">No articles yet.</li>'; return; }
    ul.innerHTML = "";
    articles.forEach(function(a){
        var li = document.createElement("li");
        li.style.cssText = "padding:6px 0;border-bottom:1px solid var(--border)";
        var title = document.createElement("strong");
        title.textContent = a.title;
        title.style.color = "var(--text)";
        var preview = document.createElement("p");
        preview.style.cssText = "margin:2px 0;font-size:12px;color:var(--text-muted)";
        preview.textContent = a.content.length > 80 ? a.content.slice(0,80) + "…" : a.content;
        var actions = document.createElement("div");
        actions.style.cssText = "display:flex;gap:6px;margin-top:4px";
        var editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.style.cssText = "padding:2px 10px;font-size:12px;border:1px solid var(--primary);color:var(--primary);background:transparent;border-radius:4px;cursor:pointer";
        editBtn.addEventListener("click", function(){
            document.getElementById("kb-title-input").value   = a.title;
            document.getElementById("kb-content-input").value = a.content;
            document.getElementById("kb-cancel-btn").style.display = "inline-block";
            kbEditId = a.id;
        });
        var delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.style.cssText = "padding:2px 10px;font-size:12px;border:1px solid var(--error);color:var(--error);background:transparent;border-radius:4px;cursor:pointer";
        delBtn.addEventListener("click", function(){
            if (!confirm("Delete this article?")) return;
            fetch("/api/kb/" + a.id, { method: "DELETE" }).then(function(){ loadKB(); });
        });
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        li.appendChild(title);
        li.appendChild(preview);
        li.appendChild(actions);
        ul.appendChild(li);
    });
}

function saveKbArticle() {
    var title   = document.getElementById("kb-title-input").value.trim();
    var content = document.getElementById("kb-content-input").value.trim();
    if (!title || !content) { alert("Title and content are required."); return; }
    var method = kbEditId ? "PUT" : "POST";
    var url    = kbEditId ? "/api/kb/" + kbEditId : "/api/kb";
    fetch(url, { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title, content: content, by: user.name }) })
        .then(function(){ document.getElementById("kb-title-input").value = ""; document.getElementById("kb-content-input").value = ""; cancelKbEdit(); loadKB(); });
}

function cancelKbEdit() {
    kbEditId = null;
    document.getElementById("kb-cancel-btn").style.display = "none";
    document.getElementById("kb-title-input").value   = "";
    document.getElementById("kb-content-input").value = "";
}

// ---------- Age badge helper ----------

function ageBadge(ticket) {
    if (ticket.status === "Resolved") return "";
    var days = (new Date() - new Date(ticket.createdAt)) / (1000 * 60 * 60 * 24);
    var cls  = days < 1 ? "age-fresh" : days < 3 ? "age-warn" : "age-old";
    var label = days < 1 ? "< 1 day" : days < 3 ? Math.floor(days) + " days" : Math.floor(days) + " days";
    return '<span class="age-badge ' + cls + '">' + label + '</span>';
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

// ---------- Render tickets (compact list) ----------

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
        var row           = document.createElement("div");
        row.className     = "ticket-row";
        var priorityColor = PRIORITY_COLORS[ticket.priority] || "#6c757d";
        var now           = new Date();
        var dueDate       = ticket.dueDate ? new Date(ticket.dueDate + "T23:59:59") : null;
        var isOverdue     = dueDate && dueDate < now && ticket.status !== "Resolved";
        var ticketTags    = (ticket.tags || []).map(function(id){ return allTags.find(function(t){ return t.id===id; }); }).filter(Boolean);
        var tagPillsHtml  = ticketTags.map(function(tag){
            return '<span class="tag-pill" style="background:' + tag.color + ';font-size:10px;padding:1px 6px">' + tag.name + '</span>';
        }).join(" ");

        row.innerHTML =
            '<div class="ticket-row-left">' +
                '<input type="checkbox" class="ticket-checkbox" value="' + ticket.id + '" onclick="event.stopPropagation()">' +
            '</div>' +
            '<div class="ticket-row-main" style="cursor:pointer">' +
                '<div class="ticket-row-title">' +
                    '<span class="ticket-row-name"></span>' +
                    ageBadge(ticket) +
                    (isOverdue ? '<span class="overdue-label">OVERDUE</span>' : '') +
                    (tagPillsHtml ? '<span style="margin-left:4px">' + tagPillsHtml + '</span>' : '') +
                '</div>' +
                '<div class="ticket-row-meta">' +
                    'Ticket #' + ticket.id + ' · ' +
                    '<span class="ticket-row-from"></span>' +
                    ' · ' + ticket.category +
                    (ticket.assignedTo ? ' · Assigned: ' + ticket.assignedTo : '') +
                    (ticket.dueDate ? ' · Due: ' + new Date(ticket.dueDate + "T23:59:59").toLocaleDateString() : '') +
                '</div>' +
            '</div>' +
            '<div class="ticket-row-right">' +
                '<span class="status-chip status-' + ticket.status.replace(' ','-').toLowerCase() + '">' + ticket.status + '</span>' +
                '<span class="priority-badge" style="background:' + priorityColor + '"></span>' +
                '<span style="font-size:11px;color:var(--text-faint)">' + new Date(ticket.createdAt).toLocaleDateString() + '</span>' +
            '</div>';

        row.querySelector(".ticket-row-name").textContent = ticket.title;
        row.querySelector(".ticket-row-from").textContent = ticket.studentName;

        var checkbox = row.querySelector(".ticket-checkbox");
        checkbox.checked = selectedTickets.has(ticket.id);
        checkbox.addEventListener("change", function () {
            if (this.checked) selectedTickets.add(ticket.id);
            else              selectedTickets.delete(ticket.id);
            updateBulkBar();
        });

        row.querySelector(".ticket-row-main").addEventListener("click", function () {
            window.location.href = "admin-ticket.html?id=" + ticket.id;
        });

        requestList.appendChild(row);
    });
}

function renderMessages(container, items, isNote) {
    if (!items || items.length === 0) { container.innerHTML = "<p style='color:var(--text-faint);font-size:13px;margin:0'>None yet.</p>"; return; }
    container.innerHTML = "";
    items.forEach(function (c) {
        var div = document.createElement("div");
        var isFromStudent = c.fromStudent;
        if (isNote)            div.style.cssText = "background:var(--note-bg);border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px;border-left:3px solid #8b4513";
        else if (isFromStudent) div.style.cssText = "background:var(--primary-light);border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px;border-left:3px solid var(--primary)";
        else                   div.style.cssText = "background:var(--msg-bg);border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px";
        var header = document.createElement("div");
        header.style.cssText = "font-weight:bold;margin-bottom:2px;color:var(--text-muted);font-size:12px";
        header.textContent = c.author + (isFromStudent ? " [Student]" : "") + " · " + new Date(c.createdAt).toLocaleString();
        var body = document.createElement("div");
        body.style.color = "var(--text)"; body.textContent = c.text;
        div.appendChild(header); div.appendChild(body); container.appendChild(div);
    });
}

function renderHistory(container, history) {
    if (!history || history.length === 0) { container.innerHTML = "<p style='color:var(--text-faint);font-size:12px;margin:4px 0'>No history yet.</p>"; return; }
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
        body: JSON.stringify({ name: document.getElementById("name").value.trim(), email: document.getElementById("email").value.trim(), password: document.getElementById("password").value, role: document.getElementById("role").value })
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
    Promise.all([
        fetch("/api/users").then(function(r){ return r.json(); }),
        fetch("/api/tags").then(function(r){ return r.json(); }),
        fetch("/api/quickreplies").then(function(r){ return r.json(); })
    ]).then(function(results){
        var users = results[0];
        staffUsers = users.filter(function(u){ return u.role === "admin"; });
        allTags = results[1];
        allQuickReplies = results[2];
        var bulkSel = document.getElementById("bulk-assign-sel");
        bulkSel.innerHTML = '<option value="">Assign to...</option>';
        staffUsers.forEach(function(s){ var opt = document.createElement("option"); opt.value = s.name; opt.textContent = s.name; bulkSel.appendChild(opt); });
        var unopt = document.createElement("option"); unopt.value = ""; unopt.textContent = "Unassigned"; bulkSel.appendChild(unopt);
        loadTickets();
    });
    loadUsers();
    loadAnnouncement();
    loadQuickReplies();
    loadTags();
    loadKB();
    renderSavedViews();
}
