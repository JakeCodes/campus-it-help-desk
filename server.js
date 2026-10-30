// Simple Campus IT Help Desk server.
// No packages needed. Run with:  node server.js   then open http://localhost:3000
// All data is saved in db.json (a plain JSON file used as the "database").

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "db.json");

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

// Never send passwords back to the browser
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
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
    });
}

const MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml"
};

function serveFile(res, urlPath) {
    if (urlPath === "/") {
        urlPath = fs.existsSync(path.join(__dirname, "index.html")) ? "/index.html" : "/login.html";
    }

    const filePath = path.join(__dirname, urlPath);
    const ext = path.extname(filePath);

    // Only serve web files from this folder (keeps db.json and server.js private)
    if (!filePath.startsWith(__dirname) || !MIME_TYPES[ext]) {
        res.writeHead(404);
        return res.end("Not found");
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            return res.end("Not found");
        }
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] });
        res.end(data);
    });
}

// ---------- API routes ----------

async function handleApi(req, res, url) {
    const db = readDb();

    // Log in: { email, password }
    if (req.method === "POST" && url.pathname === "/api/login") {
        const { email, password } = await readBody(req);
        const user = db.users.find(u => u.email === email && u.password === password);
        if (!user) return sendJson(res, 401, { error: "Wrong email or password" });
        return sendJson(res, 200, publicUser(user));
    }

    // List users (for the admin page)
    if (req.method === "GET" && url.pathname === "/api/users") {
        return sendJson(res, 200, db.users.map(publicUser));
    }

    // Add a user: { name, email, password, role }
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
            name,
            email,
            password,
            role: role === "admin" ? "admin" : "student"
        };
        db.users.push(user);
        saveDb(db);
        return sendJson(res, 201, publicUser(user));
    }

    // List tickets. ?email=... gives one student's tickets; no email gives all (admin)
    if (req.method === "GET" && url.pathname === "/api/tickets") {
        const email = url.searchParams.get("email");
        const tickets = email ? db.tickets.filter(t => t.studentEmail === email) : db.tickets;
        return sendJson(res, 200, tickets);
    }

    // Add a ticket: { email, title, category, description }
    if (req.method === "POST" && url.pathname === "/api/tickets") {
        const { email, title, category, description } = await readBody(req);
        const student = db.users.find(u => u.email === email);
        if (!student) return sendJson(res, 400, { error: "Unknown student" });
        if (!title || !description) {
            return sendJson(res, 400, { error: "Title and description are required" });
        }
        const ticket = {
            id: nextId(db.tickets),
            studentEmail: student.email,
            studentName: student.name,
            title,
            category: category || "Other",
            description,
            status: "Open",
            createdAt: new Date().toISOString()
        };
        db.tickets.push(ticket);
        saveDb(db);
        return sendJson(res, 201, ticket);
    }

    // Change a ticket's status (admin): PUT /api/tickets/3  { status }
    const match = url.pathname.match(/^\/api\/tickets\/(\d+)$/);
    if (req.method === "PUT" && match) {
        const { status } = await readBody(req);
        const ticket = db.tickets.find(t => t.id === Number(match[1]));
        if (!ticket) return sendJson(res, 404, { error: "Ticket not found" });
        ticket.status = status;
        saveDb(db);
        return sendJson(res, 200, ticket);
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
