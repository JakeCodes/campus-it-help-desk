var user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

var requestList  = document.getElementById("request-list");
var paginationEl = document.getElementById("pagination");

var PRIORITY_ORDER  = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
var PRIORITY_COLORS = { Low: "#6c757d", Medium: "#0066cc", High: "#e67e00", Urgent: "#cc0000" };
var PAGE_SIZE  = 10;
var currentPage = 1;
var allTickets  = [];

// ---------- Dark mode ----------

function toggleDark() {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    var next   = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    document.getElementById("dark-toggle").textContent = isDark ? "Dark Mode" : "Light Mode";
}

(function () {
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    document.getElementById("dark-toggle").textContent = isDark ? "Light Mode" : "Dark Mode";
})();

// ---------- Tickets ----------

function loadAnnouncement() {
    fetch("/api/announcement").then(function(r){ return r.json(); }).then(function(data){
        var bar = document.getElementById("announcement-bar");
        if (data.announcement && data.announcement.active) {
            document.getElementById("announcement-text").textContent = data.announcement.text;
            bar.style.display = "flex";
        } else {
            bar.style.display = "none";
        }
    });
}

async function loadTickets() {
    var res = await fetch("/api/tickets?email=" + encodeURIComponent(user.email));
    allTickets = await res.json();

    // Unread badge
    var unread = allTickets.filter(function (t) { return t.studentUnread; });
    var badge  = document.getElementById("unread-badge");
    if (unread.length > 0) {
        badge.textContent  = unread.length + " new";
        badge.style.display = "inline";
        unread.forEach(function (t) {
            fetch("/api/tickets/" + t.id + "/read", { method: "PUT" });
            t.studentUnread = false;
        });
    } else {
        badge.style.display = "none";
    }

    renderTickets();
}

function getFilters() {
    return {
        search: document.getElementById("search").value.toLowerCase(),
        status: document.getElementById("filter-status").value,
        sort:   document.getElementById("sort-by").value
    };
}

function applyFiltersAndSort() {
    var f = getFilters();
    var list = allTickets.filter(function (t) {
        if (f.status && t.status !== f.status) return false;
        if (f.search && !t.title.toLowerCase().includes(f.search) &&
                        !t.description.toLowerCase().includes(f.search)) return false;
        return true;
    });
    list.sort(function (a, b) {
        if (f.sort === "date-asc")      return new Date(a.createdAt) - new Date(b.createdAt);
        if (f.sort === "date-desc")     return new Date(b.createdAt) - new Date(a.createdAt);
        if (f.sort === "priority-desc") return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
        if (f.sort === "priority-asc")  return (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0);
        if (f.sort === "status")        return ["Open","In Progress","Resolved"].indexOf(a.status) - ["Open","In Progress","Resolved"].indexOf(b.status);
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return list;
}

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
        var comments      = ticket.comments || [];

        var isImage    = ticket.attachment && /\.(png|jpg|jpeg|gif|webp)$/i.test(ticket.attachment.name);
        var attachHtml = ticket.attachment ? (
            isImage
                ? '<div style="margin-top:8px"><a href="' + ticket.attachment.url + '" target="_blank"><img src="' + ticket.attachment.url + '" alt="' + ticket.attachment.name + '" style="max-width:100%;max-height:140px;border-radius:4px;border:1px solid var(--border)"></a></div>'
                : '<div style="margin-top:8px"><a href="' + ticket.attachment.url + '" target="_blank" style="color:var(--primary)">Attachment: ' + ticket.attachment.name + '</a></div>'
        ) : "";

        var canReopen    = ticket.status === "Resolved";
        var isResolved   = ticket.status === "Resolved";
        var ratingHtml   = "";
        if (isResolved) {
            if (ticket.rating) {
                var stars = "★".repeat(ticket.rating.stars) + "☆".repeat(5 - ticket.rating.stars);
                ratingHtml = '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;font-size:13px"><strong>Your rating:</strong> <span style="color:#f5a623">' + stars + '</span>' + (ticket.rating.comment ? ' — ' + ticket.rating.comment : '') + '</div>';
            } else {
                ratingHtml = '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;font-size:13px"><strong>How was this resolved?</strong><div class="star-rating" data-ticketid="' + ticket.id + '">' + [1,2,3,4,5].map(function(n){ return '<span class="star" data-value="'+n+'">&#9733;</span>'; }).join("") + '</div><input class="rating-comment" type="text" placeholder="Optional comment..." style="width:100%;box-sizing:border-box;margin-top:4px;padding:5px 8px;font-size:13px;border:1px solid var(--border);border-radius:4px;background:var(--input-bg);color:var(--text)"><button class="rating-btn btn btn-primary" style="margin-top:6px;padding:5px 14px;font-size:13px">Submit Rating</button></div>';
            }
        }
        var updatedText = ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : "";
        var now         = new Date();
        var dueDateObj  = ticket.dueDate ? new Date(ticket.dueDate + "T23:59:59") : null;
        var isOverdue   = dueDateObj && dueDateObj < now && ticket.status !== "Resolved";
        var dueDateHtml = "";
        if (dueDateObj) {
            var dueStr = dueDateObj.toLocaleDateString();
            dueDateHtml = '<p style="margin:4px 0"><strong>Due:</strong> <span style="color:' + (isOverdue ? "var(--error)" : "var(--text)") + '">' + dueStr + (isOverdue ? " (Overdue)" : "") + '</span></p>';
        }

        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">' +
                '<h3 style="margin:0;flex:1;margin-right:8px;color:var(--text)"></h3>' +
                '<span class="priority-badge" style="background:' + priorityColor + '"></span>' +
            '</div>' +
            '<p style="margin:2px 0;font-size:12px;color:var(--text-faint)">Ticket #' + ticket.id + (updatedText ? ' · Updated: ' + updatedText : '') + '</p>' +
            '<p style="margin:4px 0"><strong>Category:</strong> <span class="cat-text" style="color:var(--text)"></span></p>' +
            '<p style="margin:4px 0"><strong>Status:</strong> <span class="status-text" style="color:var(--text)"></span>' +
                (canReopen ? ' <button class="reopen-btn btn" style="margin-left:10px;padding:2px 10px;font-size:12px;border-color:#e67e00;color:#e67e00;background:transparent">Reopen</button>' : "") +
            '</p>' +
            '<p style="margin:4px 0"><strong>Submitted:</strong> <span class="created-text" style="color:var(--text)"></span></p>' +
            dueDateHtml +
            '<p class="desc" style="margin:8px 0;color:var(--text-muted)"></p>' +
            attachHtml +
            ratingHtml +
            '<div class="comment-block" style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px">' +
                '<strong style="color:var(--text)">Conversation (<span class="comment-count">' + comments.length + '</span>)</strong>' +
                '<div class="comment-list" style="margin:8px 0"></div>' +
                '<div style="display:flex;gap:8px;margin-top:6px">' +
                    '<input class="reply-input" type="text" placeholder="Reply to staff..." style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:4px;font-size:13px;background:var(--input-bg);color:var(--text)">' +
                    '<button class="reply-btn btn btn-primary" style="padding:6px 12px;font-size:13px">Send</button>' +
                '</div>' +
            '</div>';

        card.querySelector("h3").textContent          = ticket.title;
        card.querySelector(".priority-badge").textContent = ticket.priority || "Medium";
        card.querySelector(".cat-text").textContent   = ticket.category;
        card.querySelector(".status-text").textContent = ticket.status;
        card.querySelector(".created-text").textContent = new Date(ticket.createdAt).toLocaleDateString();
        card.querySelector(".desc").textContent        = ticket.description;

        // Star rating
        var starRating = card.querySelector(".star-rating");
        if (starRating) {
            var selectedStars = 0;
            var stars = starRating.querySelectorAll(".star");
            stars.forEach(function(star){
                star.addEventListener("mouseover", function(){
                    var v = parseInt(star.dataset.value);
                    stars.forEach(function(s){ s.classList.toggle("filled", parseInt(s.dataset.value) <= v); });
                });
                star.addEventListener("mouseleave", function(){
                    stars.forEach(function(s){ s.classList.toggle("filled", parseInt(s.dataset.value) <= selectedStars); });
                });
                star.addEventListener("click", function(){
                    selectedStars = parseInt(star.dataset.value);
                    stars.forEach(function(s){ s.classList.toggle("filled", parseInt(s.dataset.value) <= selectedStars); });
                });
            });
            var ratingBtn = card.querySelector(".rating-btn");
            if (ratingBtn) {
                ratingBtn.addEventListener("click", async function(){
                    if (!selectedStars) { alert("Please select a star rating."); return; }
                    var comment = card.querySelector(".rating-comment").value.trim();
                    var r = await fetch("/api/tickets/" + ticket.id + "/rating", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stars: selectedStars, comment: comment, by: user.name }) });
                    if (r.ok) { ticket.rating = { stars: selectedStars, comment: comment }; renderTickets(); }
                });
            }
        }

        if (canReopen) {
            card.querySelector(".reopen-btn").addEventListener("click", async function () {
                var r = await fetch("/api/tickets/" + ticket.id, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "Open", changedBy: user.name })
                });
                if (r.ok) { ticket.status = "Open"; renderTickets(); }
            });
        }

        var commentList = card.querySelector(".comment-list");
        renderComments(commentList, comments);

        var replyInput = card.querySelector(".reply-input");
        card.querySelector(".reply-btn").addEventListener("click", async function () {
            var text = replyInput.value.trim();
            if (!text) return;
            var r = await fetch("/api/tickets/" + ticket.id + "/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ author: user.name, text: text, fromStudent: true })
            });
            if (r.ok) {
                var c = await r.json();
                ticket.comments = ticket.comments || [];
                ticket.comments.push(c);
                renderComments(commentList, ticket.comments);
                replyInput.value = "";
                card.querySelector(".comment-count").textContent = ticket.comments.length;
            }
        });
        replyInput.addEventListener("keydown", function (e) { if (e.key === "Enter") card.querySelector(".reply-btn").click(); });

        requestList.appendChild(card);
    });
}

function renderComments(container, comments) {
    if (!comments || comments.length === 0) {
        container.innerHTML = "<p style='color:var(--text-faint);font-size:13px;margin:0'>No messages yet.</p>";
        return;
    }
    container.innerHTML = "";
    comments.forEach(function (c) {
        var div       = document.createElement("div");
        var isStudent = c.fromStudent;
        if (isStudent) {
            div.style.cssText = "background:var(--primary-light);border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px;border-left:3px solid var(--primary);margin-left:20px";
        } else {
            div.style.cssText = "background:var(--msg-bg);border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px";
        }
        var header = document.createElement("div");
        header.style.cssText = "font-weight:bold;margin-bottom:2px;color:var(--text-muted);font-size:12px";
        header.textContent = (isStudent ? "You" : c.author) + " · " + new Date(c.createdAt).toLocaleString();
        var body = document.createElement("div");
        body.style.color   = "var(--text)";
        body.textContent   = c.text;
        div.appendChild(header);
        div.appendChild(body);
        container.appendChild(div);
    });
}

["search", "filter-status", "sort-by"].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener("input",  function () { currentPage = 1; renderTickets(); });
    el.addEventListener("change", function () { currentPage = 1; renderTickets(); });
});

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

if (user) {
    document.getElementById("page-heading").textContent = user.name + "'s IT Requests";
    loadTickets();
    loadAnnouncement();
}
