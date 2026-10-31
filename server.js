const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "db.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const DEFAULT_DB = {
    users: [{ id: 1, name: "Alex Admin", email: "admin@campus.edu", password: "admin123", role: "admin" }],
    tickets: []
};
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));

// ---------- Password helpers ----------

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return salt + ":" + hash;
}

function verifyPassword(password, stored) {
    if (!stored || !stored.includes(":")) return stored === password;
    const [salt, hash] = stored.split(":");
    try {
        const buf = crypto.scryptSync(password, salt, 64);
        return crypto.timingSafeEqual(buf, Buffer.from(hash, "hex"));
    } catch { return false; }
}

// ---------- Database helpers ----------

function readDb() {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDb(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function nextId(list) {
    return list.length === 0 ? 1 : Math.max(...list.map(item => item.id)) + 1;
}

function publicUser(user) {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// ---------- Request helpers ----------

function sendJson(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => (body += chunk));
        req.on("end", () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (err) { reject(err); }
        });
    });
}

const MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf"
};

const ALLOWED_UPLOAD_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf"]);

function serveFile(res, urlPath) {
    if (urlPath === "/") {
        urlPath = fs.existsSync(path.join(__dirname, "index.html")) ? "/index.html" : "/login.html";
    }

    let filePath, ext;
    if (urlPath.startsWith("/uploads/")) {
        filePath = path.join(UPLOADS_DIR, path.basename(urlPath));
        ext = path.extname(filePath).toLowerCase();
    } else {
        filePath = path.join(__dirname, urlPath);
        ext = path.extname(filePath);
        if (!filePath.startsWith(__dirname) || !MIME_TYPES[ext]) {
            res.writeHead(404);
            return res.end("Not found");
        }
    }

    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); return res.end("Not found"); }
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
        res.end(data);
    });
}

// ---------- API routes ----------

async function handleApi(req, res, url) {
    const db = readDb();

    // POST /api/login
    if (req.method === "POST" && url.pathname === "/api/login") {
        const { email, password } = await readBody(req);
        const user = db.users.find(u => u.email === email);
        if (!user || !verifyPassword(password, user.password)) {
            return sendJson(res, 401, { error: "Wrong email or password" });
        }
        if (!user.password.includes(":")) {
            user.password = hashPassword(password);
            saveDb(db);
        }
        return sendJson(res, 200, publicUser(user));
    }

    // GET /api/users
    if (req.method === "GET" && url.pathname === "/api/users") {
        return sendJson(res, 200, db.users.map(publicUser));
    }

    // POST /api/users
    if (req.method === "POST" && url.pathname === "/api/users") {
        const { name, email, password, role } = await readBody(req);
        if (!name || !email || !password) {
            return sendJson(res, 400, { error: "Name, email and password are required" });
        }
        if (db.users.some(u => u.email === email)) {
            return sendJson(res, 400, { error: "That email is already registered" });
        }
        const user = {
            id: nextId(db.users),
            name, email,
            password: hashPassword(password),
            role: role === "admin" ? "admin" : "student"
        };
        db.users.push(user);
        saveDb(db);
        return sendJson(res, 201, publicUser(user));
    }

    // PUT /api/users/:id
    const userMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
    if (req.method === "PUT" && userMatch) {
        const { name, currentPassword, newPassword } = await readBody(req);
        const user = db.users.find(u => u.id === Number(userMatch[1]));
        if (!user) return sendJson(res, 404, { error: "User not found" });
        if (!verifyPassword(currentPassword, user.password)) {
            return sendJson(res, 401, { error: "Current password is incorrect" });
        }
        if (name) user.name = name;
        if (newPassword) user.password = hashPassword(newPassword);
        saveDb(db);
        return sendJson(res, 200, publicUser(user));
    }

    // DELETE /api/users/:id
    if (req.method === "DELETE" && userMatch) {
        if (Number(userMatch[1]) === 1) return sendJson(res, 403, { error: "The primary admin account cannot be deleted" });
        const idx = db.users.findIndex(u => u.id === Number(userMatch[1]));
        if (idx === -1) return sendJson(res, 404, { error: "User not found" });
        db.users.splice(idx, 1);
        saveDb(db);
        return sendJson(res, 200, { ok: true });
    }

    // GET /api/tickets
    if (req.method === "GET" && url.pathname === "/api/tickets") {
        const email = url.searchParams.get("email");
        const tickets = email ? db.tickets.filter(t => t.studentEmail === email) : db.tickets;
        return sendJson(res, 200, tickets);
    }

    // POST /api/tickets
    if (req.method === "POST" && url.pathname === "/api/tickets") {
        const { email, title, category, priority, description, attachment } = await readBody(req);
        const student = db.users.find(u => u.email === email);
        if (!student) return sendJson(res, 400, { error: "Unknown student" });
        if (!title || !description) {
            return sendJson(res, 400, { error: "Title and description are required" });
        }

        let attachmentInfo = null;
        if (attachment && attachment.data && attachment.name) {
            const ext = path.extname(attachment.name).toLowerCase();
            if (ALLOWED_UPLOAD_EXTS.has(ext)) {
                const filename = Date.now() + "-" + crypto.randomBytes(4).toString("hex") + ext;
                const base64Data = attachment.data.replace(/^data:[^;]+;base64,/, "");
                fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(base64Data, "base64"));
                attachmentInfo = { name: attachment.name, url: "/uploads/" + filename };
            }
        }

        const now = new Date().toISOString();
        const ticket = {
            id: nextId(db.tickets),
            studentEmail: student.email,
            studentName: student.name,
            title,
            category: category || "Other",
            priority: ["Low", "Medium", "High", "Urgent"].includes(priority) ? priority : "Medium",
            description,
            status: "Open",
            assignedTo: null,
            dueDate: null,
            attachment: attachmentInfo,
            comments: [],
            internalNotes: [],
            history: [{ at: now, by: student.name, action: "Ticket created" }],
            studentUnread: false,
            createdAt: now,
            updatedAt: now
        };
        db.tickets.push(ticket);
        saveDb(db);
        return sendJson(res, 201, ticket);
    }

    // POST /api/tickets/bulk
    if (req.method === "POST" && url.pathname === "/api/tickets/bulk") {
        const { action, ticketIds, value } = await readBody(req);
        if (!action || !Array.isArray(ticketIds)) {
            return sendJson(res, 400, { error: "action and ticketIds are required" });
        }
        const now = new Date().toISOString();
        let updated = 0;

        if (action === "delete") {
            for (let i = db.tickets.length - 1; i >= 0; i--) {
                if (ticketIds.map(Number).includes(db.tickets[i].id)) {
                    const removed = db.tickets[i];
                    if (removed.attachment && removed.attachment.url) {
                        const fp = path.join(UPLOADS_DIR, path.basename(removed.attachment.url));
                        if (fs.existsSync(fp)) fs.unlinkSync(fp);
                    }
                    db.tickets.splice(i, 1);
                    updated++;
                }
            }
        } else {
            ticketIds.map(Number).forEach(id => {
                const ticket = db.tickets.find(t => t.id === id);
                if (!ticket) return;
                if (!ticket.history) ticket.history = [];
                if (action === "status" && value) {
                    ticket.history.push({ at: now, by: "Admin", action: "Status changed to " + value + " (bulk)" });
                    ticket.status = value;
                    ticket.updatedAt = now;
                    updated++;
                } else if (action === "assign") {
                    ticket.history.push({ at: now, by: "Admin", action: "Assigned to " + (value || "Unassigned") + " (bulk)" });
                    ticket.assignedTo = value || null;
                    ticket.updatedAt = now;
                    updated++;
                }
            });
        }

        saveDb(db);
        return sendJson(res, 200, { ok: true, updated });
    }

    // PUT /api/tickets/:id
    const ticketMatch = url.pathname.match(/^\/api\/tickets\/(\d+)$/);
    if (req.method === "PUT" && ticketMatch) {
        const body = await readBody(req);
        const ticket = db.tickets.find(t => t.id === Number(ticketMatch[1]));
        if (!ticket) return sendJson(res, 404, { error: "Ticket not found" });
        const now = new Date().toISOString();
        const by = body.changedBy || "Admin";
        if (!ticket.history) ticket.history = [];

        if (body.status !== undefined && body.status !== ticket.status) {
            ticket.history.push({ at: now, by, action: "Status changed from " + ticket.status + " to " + body.status });
            ticket.status = body.status;
        }
        if (body.assignedTo !== undefined && body.assignedTo !== ticket.assignedTo) {
            ticket.history.push({ at: now, by, action: "Assigned to " + (body.assignedTo || "Unassigned") });
            ticket.assignedTo = body.assignedTo;
        }
        if (body.dueDate !== undefined) {
            ticket.history.push({ at: now, by, action: body.dueDate ? "Due date set to " + body.dueDate : "Due date removed" });
            ticket.dueDate = body.dueDate;
        }
        ticket.updatedAt = now;
        saveDb(db);
        return sendJson(res, 200, ticket);
    }

    // DELETE /api/tickets/:id
    if (req.method === "DELETE" && ticketMatch) {
        const idx = db.tickets.findIndex(t => t.id === Number(ticketMatch[1]));
        if (idx === -1) return sendJson(res, 404, { error: "Ticket not found" });
        const removed = db.tickets[idx];
        if (removed.attachment && removed.attachment.url) {
            const fp = path.join(UPLOADS_DIR, path.basename(removed.attachment.url));
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
        db.tickets.splice(idx, 1);
        saveDb(db);
        return sendJson(res, 200, { ok: true });
    }

    // PUT /api/tickets/:id/read  (clear studentUnread flag)
    const readMatch = url.pathname.match(/^\/api\/tickets\/(\d+)\/read$/);
    if (req.method === "PUT" && readMatch) {
        const ticket = db.tickets.find(t => t.id === Number(readMatch[1]));
        if (!ticket) return sendJson(res, 404, { error: "Ticket not found" });
        ticket.studentUnread = false;
        saveDb(db);
        return sendJson(res, 200, { ok: true });
    }

    // POST /api/tickets/:id/comments
    const commentMatch = url.pathname.match(/^\/api\/tickets\/(\d+)\/comments$/);
    if (req.method === "POST" && commentMatch) {
        const { author, text, fromStudent } = await readBody(req);
        if (!text) return sendJson(res, 400, { error: "Comment text is required" });
        const ticket = db.tickets.find(t => t.id === Number(commentMatch[1]));
        if (!ticket) return sendJson(res, 404, { error: "Ticket not found" });
        if (!ticket.comments) ticket.comments = [];
        const now = new Date().toISOString();
        const comment = { id: nextId(ticket.comments), author: author || "Unknown", text, fromStudent: !!fromStudent, createdAt: now };
        ticket.comments.push(comment);
        if (!ticket.history) ticket.history = [];
        ticket.history.push({ at: now, by: author || "Unknown", action: fromStudent ? "Student reply added" : "Staff comment added" });
        if (!fromStudent) ticket.studentUnread = true;
        ticket.updatedAt = now;
        saveDb(db);
        return sendJson(res, 201, comment);
    }

    // POST /api/tickets/:id/notes  (internal, admin-only)
    const noteMatch = url.pathname.match(/^\/api\/tickets\/(\d+)\/notes$/);
    if (req.method === "POST" && noteMatch) {
        const { author, text } = await readBody(req);
        if (!text) return sendJson(res, 400, { error: "Note text is required" });
        const ticket = db.tickets.find(t => t.id === Number(noteMatch[1]));
        if (!ticket) return sendJson(res, 404, { error: "Ticket not found" });
        if (!ticket.internalNotes) ticket.internalNotes = [];
        const now = new Date().toISOString();
        const note = { id: nextId(ticket.internalNotes), author: author || "Unknown", text, createdAt: now };
        ticket.internalNotes.push(note);
        if (!ticket.history) ticket.history = [];
        ticket.history.push({ at: now, by: author || "Unknown", action: "Internal note added" });
        ticket.updatedAt = now;
        saveDb(db);
        return sendJson(res, 201, note);
    }

    sendJson(res, 404, { error: "Unknown API route" });
}

// ---------- Start ----------

http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
        if (url.pathname.startsWith("/api/")) {
            await handleApi(req, res, url);
        } else {
            serveFile(res, decodeURIComponent(url.pathname));
        }
    } catch (err) {
        console.error(err);
        sendJson(res, 500, { error: "Server error" });
    }
}).listen(PORT, () => {
    console.log(`Campus IT Help Desk running at http://localhost:${PORT}`);
});
