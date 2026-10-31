# Campus IT Help Desk

A web app where students submit IT support requests and IT staff manage them. No frameworks or npm packages required — just Node.js.

---

## Setup

### 1. Install Node.js
Download and install from [nodejs.org](https://nodejs.org/) (LTS version).

### 2. Clone the repo
```bash
git clone https://github.com/JakeCodes/campus-it-help-desk.git
cd campus-it-help-desk
```

### 3. Start the server
```bash
node server.js
```

### 4. Open in your browser
```
http://localhost:3000
```

On first run, `db.json` is automatically created with a default admin account. No manual setup needed.

---

## Default Login

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@campus.edu` | `admin123` |

> **Change the admin password** after first login via the My Profile page.

---

## Features

### Students
- Create an account and sign in
- Submit IT support tickets with a title, category, priority, and description
- Attach a screenshot or PDF (up to 5 MB)
- View all your tickets and their current status
- Filter and search your tickets
- Sort by date, priority, or status
- See staff comments and reply to them directly
- Reopen a resolved ticket if the issue comes back
- Update your name or password from your profile page
- Unread badge shows when staff has added a new comment since your last visit
- Due date shown on tickets (highlighted red if overdue)
- Dark mode toggle (preference saved across sessions)
- Auto logout after 30 minutes of inactivity

### IT Staff (Admin)
- View all submitted tickets across all students
- Dashboard stats showing Total / Open / In Progress / Resolved counts (click to filter)
- Filter tickets by status, priority, and category
- Search tickets by title, student name, description, or ticket ID (type `#5`)
- Sort tickets by date, priority, or status
- Pagination (10 tickets per page)
- Change ticket status (Open → In Progress → Resolved)
- Assign tickets to a staff member
- Set a due date on any ticket — overdue tickets are flagged red
- Bulk actions — select multiple tickets to set status, assign, or delete all at once
- Add student-visible comments to tickets
- Students can reply to comments directly
- Add private internal notes (staff-only, never shown to students)
- Full audit history on every ticket — every status change, assignment, comment, and note is logged with timestamp and author
- Dashboard charts — donut chart by status, bar chart by category (click "Show Charts")
- Export current filtered tickets to CSV
- Last updated timestamp on every ticket
- Add and delete user accounts
- View and update your own profile
- Dark mode toggle
- Auto logout after 30 minutes of inactivity

---

## Files

| File | Purpose |
|------|---------|
| `server.js` | Web server and REST API |
| `session.js` | Shared session timeout (auto-logout after 30 min) |
| `db.json` | Database (auto-created on first run, gitignored) |
| `uploads/` | Ticket attachments (gitignored) |
| `index.html` | Homepage |
| `login.html` / `login.js` | Sign in |
| `register.html` / `register.js` | Create student account |
| `student.html` / `student.js` | Student ticket dashboard |
| `new-request.html` / `new-request.js` | Submit a new ticket |
| `admin.html` / `admin.js` | Admin dashboard |
| `profile.html` / `profile.js` | Update name / change password |
| `pages.css` | Shared styles (with dark mode CSS variables) |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Log in |
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create a user |
| PUT | `/api/users/:id` | Update profile |
| DELETE | `/api/users/:id` | Delete a user |
| GET | `/api/tickets` | List tickets (all or by email) |
| POST | `/api/tickets` | Submit a ticket |
| POST | `/api/tickets/bulk` | Bulk status / assign / delete |
| PUT | `/api/tickets/:id` | Update status / assignee / due date |
| DELETE | `/api/tickets/:id` | Delete a ticket |
| PUT | `/api/tickets/:id/read` | Mark ticket as read (clears student unread flag) |
| POST | `/api/tickets/:id/comments` | Add a comment (student or staff) |
| POST | `/api/tickets/:id/notes` | Add an internal staff note |

---

## Security Notes

- Passwords are hashed using Node's built-in `crypto` module (scrypt)
- `db.json` and `uploads/` are gitignored and never pushed to the repo
- The primary admin account (id 1) cannot be deleted
- Sessions auto-expire after 30 minutes of inactivity
