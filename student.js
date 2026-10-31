const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

const requestList = document.getElementById("request-list");
const paginationEl = document.getElementById("pagination");

const PRIORITY_ORDER = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
const PRIORITY_COLORS = { Low: "#6c757d", Medium: "#0066cc", High: "#e67e00", Urgent: "#cc0000" };
const PAGE_SIZE = 10;
let currentPage = 1;
let allTickets = [];

async function loadTickets() {
    const res = await fetch("/api/tickets?email=" + encodeURIComponent(user.email));
    allTickets = await res.json();
    renderTickets();
}

function getFilters() {
    return {
        search: document.getElementById("search").value.toLowerCase(),
        status: document.getElementById("filter-status").value,
        sort: document.getElementById("sort-by").value
    };
}

function applyFiltersAndSort() {
    const { search, status, sort } = getFilters();
    let list = allTickets.filter(t => {
        if (status && t.status !== status) return false;
        if (search && !t.title.toLowerCase().includes(search) &&
            !t.description.toLowerCase().includes(search)) return false;
        return true;
    });

    list.sort((a, b) => {
        if (sort === "date-asc") return new Date(a.createdAt) - new Date(b.createdAt);
        if (sort === "date-desc") return new Date(b.createdAt) - new Date(a.createdAt);
        if (sort === "priority-desc") return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
        if (sort === "priority-asc") return (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0);
        if (sort === "status") return ["Open", "In Progress", "Resolved"].indexOf(a.status) - ["Open", "In Progress", "Resolved"].indexOf(b.status);
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return list;
}

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

        const isImage = ticket.attachment && /\.(png|jpg|jpeg|gif|webp)$/i.test(ticket.attachment.name);
        const attachHtml = ticket.attachment ? (
            isImage
                ? `<div style="margin-top:8px"><a href="${ticket.attachment.url}" target="_blank"><img src="${ticket.attachment.url}" alt="${ticket.attachment.name}" style="max-width:100%;max-height:140px;border-radius:4px;border:1px solid #ddd"></a></div>`
                : `<div style="margin-top:8px"><a href="${ticket.attachment.url}" target="_blank" style="color:#0066cc">📎 ${ticket.attachment.name}</a></div>`
        ) : "";

        const canReopen = ticket.status === "Resolved";

        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
                <h3 style="margin:0;flex:1;margin-right:8px"></h3>
                <span class="priority-badge" style="background:${priorityColor}"></span>
            </div>
            <p style="margin:4px 0"><strong>Category:</strong> <span class="category"></span></p>
            <p style="margin:4px 0"><strong>Status:</strong> <span class="status-text"></span>
                ${canReopen ? '<button class="reopen-btn btn" style="margin-left:10px;padding:2px 10px;font-size:12px;border-color:#e67e00;color:#e67e00;background:transparent">Reopen</button>' : ""}
            </p>
            <p style="margin:4px 0"><strong>Submitted:</strong> <span class="created"></span></p>
            <p class="desc" style="margin:8px 0;color:#555"></p>
            ${attachHtml}
            <div class="comment-block" style="margin-top:14px;border-top:1px solid #eee;padding-top:10px">
                <strong>Staff Notes (${comments.length})</strong>
                <div class="comment-list" style="margin:8px 0"></div>
            </div>
        `;

        card.querySelector("h3").textContent = ticket.title;
        card.querySelector(".priority-badge").textContent = ticket.priority || "Medium";
        card.querySelector(".category").textContent = ticket.category;
        card.querySelector(".status-text").textContent = ticket.status;
        card.querySelector(".created").textContent = new Date(ticket.createdAt).toLocaleDateString();
        card.querySelector(".desc").textContent = ticket.description;

        if (canReopen) {
            card.querySelector(".reopen-btn").addEventListener("click", async () => {
                const r = await fetch("/api/tickets/" + ticket.id, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "Open" })
                });
                if (r.ok) {
                    ticket.status = "Open";
                    renderTickets();
                }
            });
        }

        const commentList = card.querySelector(".comment-list");
        if (comments.length === 0) {
            commentList.innerHTML = "<p style='color:#888;font-size:13px;margin:0'>No staff notes yet.</p>";
        } else {
            comments.forEach(function (c) {
                const div = document.createElement("div");
                div.style.cssText = "background:#f5f5f5;border-radius:4px;padding:6px 10px;margin-bottom:6px;font-size:13px";
                const header = document.createElement("div");
                header.style.cssText = "font-weight:bold;margin-bottom:2px;color:#333";
                header.textContent = c.author + " · " + new Date(c.createdAt).toLocaleString();
                const body = document.createElement("div");
                body.textContent = c.text;
                div.appendChild(header);
                div.appendChild(body);
                commentList.appendChild(div);
            });
        }

        requestList.appendChild(card);
    });
}

["search", "filter-status", "sort-by"].forEach(function (id) {
    const el = document.getElementById(id);
    el.addEventListener("input", () => { currentPage = 1; renderTickets(); });
    el.addEventListener("change", () => { currentPage = 1; renderTickets(); });
});

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

if (user) {
    document.querySelector(".card h2").textContent = user.name + "'s IT Requests";
    loadTickets();
}
