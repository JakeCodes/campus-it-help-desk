var user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

var ticketId = parseInt(new URLSearchParams(location.search).get("id"));
if (!ticketId) window.location.href = "admin.html";

var ticket = null;
var staffUsers = [];
var allTags = [];
var allQuickReplies = [];

var PRIORITY_COLORS = { Low: "#6c757d", Medium: "#0066cc", High: "#e67e00", Urgent: "#cc0000" };

function toggleDark() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    document.getElementById("dark-toggle").textContent = isDark ? "Dark Mode" : "Light Mode";
}
(function(){
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    document.getElementById("dark-toggle").textContent = isDark ? "Light Mode" : "Dark Mode";
})();

function logout() { localStorage.removeItem("user"); window.location.href = "login.html"; }

function ageBadge() {
    if (ticket.status === "Resolved") return "";
    var days = (Date.now() - new Date(ticket.createdAt)) / 86400000;
    var cls  = days < 1 ? "age-fresh" : days < 3 ? "age-warn" : "age-old";
    var label = days < 1 ? "< 1 day" : Math.floor(days) + "d";
    return '<span class="age-badge ' + cls + '">' + label + '</span>';
}

function renderMessages(containerId, items, isNote) {
    var container = document.getElementById(containerId);
    if (!items || items.length === 0) {
        container.innerHTML = "<p style='color:var(--text-faint);font-size:13px;margin:0'>None yet.</p>";
        return;
    }
    container.innerHTML = "";
    items.forEach(function(c) {
        var div = document.createElement("div");
        var isFromStudent = c.fromStudent;
        if (isNote)
            div.style.cssText = "background:var(--note-bg);border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px;border-left:3px solid #8b4513";
        else if (isFromStudent)
            div.style.cssText = "background:var(--primary-light);border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px;border-left:3px solid var(--primary);margin-left:20px";
        else
            div.style.cssText = "background:var(--msg-bg);border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px";
        var header = document.createElement("div");
        header.style.cssText = "font-weight:bold;margin-bottom:2px;color:var(--text-muted);font-size:12px";
        header.textContent = c.author + (isFromStudent ? " [Student]" : "") + " · " + new Date(c.createdAt).toLocaleString();
        var body = document.createElement("div");
        body.style.color = "var(--text)"; body.textContent = c.text;
        div.appendChild(header); div.appendChild(body);
        container.appendChild(div);
    });
}

function renderHistory() {
    var list = ticket.history || [];
    document.getElementById("history-count").textContent = list.length;
    var container = document.getElementById("history-list");
    if (!list.length) { container.innerHTML = "<p style='color:var(--text-faint);font-size:13px;margin:0'>No history yet.</p>"; return; }
    container.innerHTML = list.map(function(h) {
        return '<div style="font-size:12px;color:var(--text-muted);padding:4px 0;border-bottom:1px solid var(--border)">' +
            new Date(h.at).toLocaleString() + ' — ' + h.by + ': ' + h.action + '</div>';
    }).join("");
}

function renderTags() {
    var ticketTags = (ticket.tags || []).map(function(id){ return allTags.find(function(t){ return t.id===id; }); }).filter(Boolean);
    var container = document.getElementById("tkt-tags");
    container.innerHTML = ticketTags.map(function(tag) {
        return '<span class="tag-pill" style="background:' + tag.color + '" data-tagid="' + tag.id + '">' +
            tag.name + '<span class="tag-remove" title="Remove">×</span></span>';
    }).join("");
    container.querySelectorAll(".tag-remove").forEach(function(btn) {
        btn.addEventListener("click", function() {
            var tagId = parseInt(btn.closest(".tag-pill").dataset.tagid);
            var newTags = (ticket.tags || []).filter(function(id){ return id !== tagId; });
            fetch("/api/tickets/" + ticket.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: newTags, changedBy: user.name }) })
                .then(function(r){ return r.json(); }).then(function(upd){ ticket.tags = upd.tags; renderTags(); refreshTagPicker(); });
        });
    });
}

function refreshTagPicker() {
    var picker = document.getElementById("tag-picker");
    var used = ticket.tags || [];
    var avail = allTags.filter(function(t){ return !used.includes(t.id); });
    picker.innerHTML = '<option value="">+ Add tag...</option>' + avail.map(function(t){
        return '<option value="' + t.id + '">' + t.name + '</option>';
    }).join("");
}

function renderRating() {
    var el = document.getElementById("tkt-rating");
    if (!ticket.rating) { el.innerHTML = ""; return; }
    var stars = "★".repeat(ticket.rating.stars) + "☆".repeat(5 - ticket.rating.stars);
    el.innerHTML = '<span style="font-size:13px;color:var(--text-muted)">Rating: <span style="color:#f5a623">' + stars + '</span>' +
        (ticket.rating.comment ? ' — ' + ticket.rating.comment : '') + '</span>';
}

function renderTimeLog() {
    var timeLog = ticket.timeLog || [];
    var total = timeLog.reduce(function(s,e){ return s+e.hours; }, 0);
    document.getElementById("time-total").textContent = total.toFixed(1);
    var container = document.getElementById("time-list");
    if (!timeLog.length) { container.innerHTML = "<p style='color:var(--text-faint);font-size:13px;margin:0'>No time logged.</p>"; return; }
    container.innerHTML = timeLog.map(function(e) {
        return '<div class="time-entry">' + new Date(e.at).toLocaleString() + ' — ' + e.by + ': ' + e.hours + 'h' + (e.note ? ' – ' + e.note : '') + '</div>';
    }).join("");
}

async function loadTicket() {
    var res = await fetch("/api/tickets");
    var all = await res.json();
    ticket = all.find(function(t){ return t.id === ticketId; });
    if (!ticket) {
        document.getElementById("loading").textContent = "Ticket not found.";
        return;
    }

    document.title = "Ticket #" + ticket.id + " — " + ticket.title;
    document.getElementById("loading").style.display = "none";
    document.getElementById("ticket-detail").style.display = "";

    // Header
    document.getElementById("tkt-title").textContent    = ticket.title;
    document.getElementById("tkt-id").textContent       = ticket.id;
    document.getElementById("tkt-age-badge").innerHTML  = ageBadge();
    document.getElementById("tkt-from").textContent     = ticket.studentName + " (" + ticket.email + ")";
    document.getElementById("tkt-created").textContent  = "Submitted " + new Date(ticket.createdAt).toLocaleString();
    document.getElementById("tkt-category").textContent = ticket.category;
    document.getElementById("tkt-priority").style.color = PRIORITY_COLORS[ticket.priority] || "#333";
    document.getElementById("tkt-priority").textContent = ticket.priority;

    // Description
    document.getElementById("tkt-desc").textContent = ticket.description;

    // Attachment
    var attachEl = document.getElementById("tkt-attach");
    if (ticket.attachment) {
        var isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(ticket.attachment.name);
        attachEl.innerHTML = isImage
            ? '<a href="' + ticket.attachment.url + '" target="_blank"><img src="' + ticket.attachment.url + '" alt="attachment" style="max-width:100%;max-height:200px;border-radius:4px;border:1px solid var(--border)"></a>'
            : '<a href="' + ticket.attachment.url + '" target="_blank" style="color:var(--primary)">📎 ' + ticket.attachment.name + '</a>';
    }

    // Overdue
    var now = new Date();
    var dueDate = ticket.dueDate ? new Date(ticket.dueDate + "T23:59:59") : null;
    var isOverdue = dueDate && dueDate < now && ticket.status !== "Resolved";
    var overdueEl = document.getElementById("overdue-label");
    if (isOverdue) { overdueEl.className = "overdue-label"; overdueEl.textContent = "OVERDUE"; }

    // Status
    var statusSel = document.getElementById("status-sel");
    ["Open","In Progress","Resolved"].forEach(function(s) {
        var opt = document.createElement("option");
        opt.value = s; opt.textContent = s; opt.selected = s === ticket.status;
        statusSel.appendChild(opt);
    });
    statusSel.addEventListener("change", function() {
        fetch("/api/tickets/" + ticket.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: statusSel.value, changedBy: user.name }) })
            .then(function(r){ return r.json(); }).then(function(upd){ ticket.status = upd.status; ticket.updatedAt = upd.updatedAt; });
    });

    // Assign
    var assignSel = document.getElementById("assign-sel");
    staffUsers.forEach(function(s) {
        var opt = document.createElement("option");
        opt.value = s.name; opt.textContent = s.name; opt.selected = ticket.assignedTo === s.name;
        assignSel.appendChild(opt);
    });
    assignSel.addEventListener("change", function() {
        fetch("/api/tickets/" + ticket.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedTo: assignSel.value || null, changedBy: user.name }) });
    });

    // Due date
    var dueInput = document.getElementById("due-input");
    dueInput.value = ticket.dueDate || "";
    function saveDue(val) {
        fetch("/api/tickets/" + ticket.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dueDate: val, changedBy: user.name }) })
            .then(function(r){ return r.json(); }).then(function(upd){ ticket.dueDate = val; ticket.updatedAt = upd.updatedAt; });
    }
    dueInput.addEventListener("change", function(){ saveDue(this.value || null); });
    document.querySelectorAll(".due-preset-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
            var d = new Date(Date.now() + parseInt(btn.dataset.hours) * 3600000);
            var val = d.toISOString().slice(0,10);
            dueInput.value = val; saveDue(val);
        });
    });

    // Tags
    renderTags();
    refreshTagPicker();
    document.getElementById("tag-picker").addEventListener("change", function() {
        var tagId = parseInt(this.value); if (!tagId) return;
        var newTags = (ticket.tags || []).concat([tagId]);
        fetch("/api/tickets/" + ticket.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: newTags, changedBy: user.name }) })
            .then(function(r){ return r.json(); }).then(function(upd){ ticket.tags = upd.tags; renderTags(); refreshTagPicker(); });
        this.value = "";
    });

    // Rating
    renderRating();

    // Comments
    renderMessages("comment-list", ticket.comments, false);
    document.getElementById("comment-count").textContent = (ticket.comments || []).length;

    if (allQuickReplies.length > 0) {
        var qrWrap = document.getElementById("qr-wrap");
        qrWrap.innerHTML = '<select id="qr-picker" class="ticket-inline-select" style="font-size:12px;width:100%"><option value="">Quick reply...</option>' +
            allQuickReplies.map(function(q){ return '<option value="'+q.id+'">'+q.text+'</option>'; }).join("") + '</select>';
        document.getElementById("qr-picker").addEventListener("change", function() {
            var id = parseInt(this.value); if (!id) return;
            var qr = allQuickReplies.find(function(q){ return q.id===id; });
            if (qr) { document.getElementById("comment-input").value = qr.text; document.getElementById("comment-input").focus(); }
            this.value = "";
        });
    }

    var commentInput = document.getElementById("comment-input");
    document.getElementById("comment-btn").addEventListener("click", async function() {
        var text = commentInput.value.trim(); if (!text) return;
        var r = await fetch("/api/tickets/" + ticket.id + "/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ author: user.name, text: text, fromStudent: false }) });
        if (r.ok) { var c = await r.json(); ticket.comments = ticket.comments || []; ticket.comments.push(c); renderMessages("comment-list", ticket.comments, false); commentInput.value = ""; document.getElementById("comment-count").textContent = ticket.comments.length; }
    });
    commentInput.addEventListener("keydown", function(e){ if (e.key==="Enter") document.getElementById("comment-btn").click(); });

    // Notes
    renderMessages("note-list", ticket.internalNotes, true);
    document.getElementById("note-count").textContent = (ticket.internalNotes || []).length;
    var noteInput = document.getElementById("note-input");
    document.getElementById("note-btn").addEventListener("click", async function() {
        var text = noteInput.value.trim(); if (!text) return;
        var r = await fetch("/api/tickets/" + ticket.id + "/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ author: user.name, text: text }) });
        if (r.ok) { var n = await r.json(); ticket.internalNotes = ticket.internalNotes || []; ticket.internalNotes.push(n); renderMessages("note-list", ticket.internalNotes, true); noteInput.value = ""; document.getElementById("note-count").textContent = ticket.internalNotes.length; }
    });
    noteInput.addEventListener("keydown", function(e){ if (e.key==="Enter") document.getElementById("note-btn").click(); });

    // Time log
    renderTimeLog();
    document.getElementById("time-btn").addEventListener("click", async function() {
        var hours = parseFloat(document.getElementById("time-hours").value);
        var note  = document.getElementById("time-note").value.trim();
        if (isNaN(hours) || hours <= 0) { alert("Enter valid hours."); return; }
        var r = await fetch("/api/tickets/" + ticket.id + "/time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hours: hours, note: note, by: user.name }) });
        if (r.ok) { var e = await r.json(); ticket.timeLog = ticket.timeLog || []; ticket.timeLog.push(e); renderTimeLog(); document.getElementById("time-hours").value = ""; document.getElementById("time-note").value = ""; }
    });

    // Merge
    document.getElementById("merge-btn").addEventListener("click", async function() {
        var secId = parseInt(document.getElementById("merge-input").value);
        if (!secId || secId === ticket.id) { alert("Enter a valid ticket ID."); return; }
        if (!confirm("Merge ticket #" + secId + " into this ticket? Ticket #" + secId + " will be deleted.")) return;
        var r = await fetch("/api/tickets/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ primaryId: ticket.id, secondaryId: secId, mergedBy: user.name }) });
        if (r.ok) { var upd = await r.json(); ticket = upd; document.getElementById("merge-input").value = ""; alert("Merged. Refreshing..."); location.reload(); }
        else { var err = await r.json(); alert(err.error || "Merge failed."); }
    });

    // Print
    document.getElementById("print-btn").addEventListener("click", function() {
        window.open("ticket-print.html?id=" + ticket.id, "_blank", "width=780,height=900");
    });

    // Delete
    document.getElementById("delete-btn").addEventListener("click", async function() {
        if (!confirm("Delete this ticket? This cannot be undone.")) return;
        var r = await fetch("/api/tickets/" + ticket.id, { method: "DELETE" });
        if (r.ok) window.location.href = "admin.html";
    });

    // History
    renderHistory();
}

Promise.all([
    fetch("/api/users").then(function(r){ return r.json(); }),
    fetch("/api/tags").then(function(r){ return r.json(); }),
    fetch("/api/quickreplies").then(function(r){ return r.json(); })
]).then(function(results) {
    staffUsers      = results[0].filter(function(u){ return u.role === "admin"; });
    allTags         = results[1];
    allQuickReplies = results[2];
    loadTicket();
});
