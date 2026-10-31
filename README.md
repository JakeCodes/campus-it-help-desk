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
- **Satisfaction rating** — after a ticket is resolved, rate the support 1–5 stars with an optional comment
- **Announcement banner** — see site-wide notices from IT staff at the top of the page
- **Knowledge base suggestions** — when typing a new ticket title, matching help articles appear as suggestions
- Dark mode toggle (preference saved across sessions)
- Auto logout after 30 minutes of inactivity

### IT Staff (Admin)
- View all submitted tickets across all students
- Dashboard stats showing Total / Open / In Progress / Resolved counts (click to filter)
- Filter tickets by status, priority, and category
- Search tickets by title, student name, description, or ticket ID (type `#5`)
- Sort tickets by date, priority, or status
- Pagination (10 tickets per page)
- **Compact ticket list** — each ticket is a clean row; click it to open a full detail page
- Change ticket status (Open → In Progress → Resolved)
- Assign tickets to a staff member
- Set a due date — quick presets: +1hr, +1day, +3days, +1wk; overdue tickets flagged red
- **Ticket age badge** — color-coded (green/yellow/red) showing how long an open ticket has been waiting
- **Auto-delete** — resolved tickets are automatically deleted 24 hours after being resolved
- Bulk actions — select multiple tickets to set status, assign, or delete all at once
- Add student-visible comments to tickets
- **Quick reply templates** — save canned responses and insert them with one click when commenting
- Students can reply to comments directly
- Add private internal notes (staff-only, never shown to students)
- Full audit history on every ticket — every status change, assignment, comment, and note is logged with timestamp and author
- Dashboard charts — donut chart by status, bar chart by category (click "Show Charts")
- **Staff stats panel** — tickets resolved per staff member, open count per assignee, total time logged, average student rating
- Export current filtered tickets to CSV
- Last updated timestamp on every ticket
- **Ticket tags** — create custom color labels and apply them to any ticket; manage tags from the Management section
- **Saved filter views** — save your current filter settings as a named view and switch between them with one click
- **Ticket merge** — merge a duplicate ticket into another, combining all comments, notes, and time entries
- **Time tracking** — log hours worked on a ticket; admin sees totals per ticket and per staff member in stats
- **Print view** — open a clean, print-friendly view of any ticket
- **Announcement banner** — post a site-wide notice that appears at the top of every page for all users
- **Knowledge base** — create searchable help articles; students see article suggestions when submitting new tickets
- **Satisfaction ratings** — see star ratings students leave on resolved tickets
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
| `admin.html` / `admin.js` | Admin dashboard (ticket list) |
| `admin-ticket.html` / `admin-ticket.js` | Ticket detail page (status, comments, notes, time, merge) |
| `chart.umd.min.js` | Chart.js 4.4.4 bundled locally for dashboard charts |
| `profile.html` / `profile.js` | Update name / change password |
| `pages.css` | Shared styles (with dark mode CSS variables) |
| `ticket-print.html` | Clean print view for a single ticket |

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
| GET | `/api/announcement` | Get site-wide announcement |
| PUT | `/api/announcement` | Post or clear announcement |
| GET | `/api/quickreplies` | List quick reply templates |
| POST | `/api/quickreplies` | Create a quick reply template |
| DELETE | `/api/quickreplies/:id` | Delete a template |
| GET | `/api/tags` | List ticket tags |
| POST | `/api/tags` | Create a tag |
| DELETE | `/api/tags/:id` | Delete a tag |
| GET | `/api/kb` | List knowledge base articles |
| POST | `/api/kb` | Create an article |
| PUT | `/api/kb/:id` | Update an article |
| DELETE | `/api/kb/:id` | Delete an article |
| POST | `/api/tickets/merge` | Merge two tickets |
| POST | `/api/tickets/:id/rating` | Submit student satisfaction rating |
| POST | `/api/tickets/:id/time` | Log time on a ticket |

---

## Security Notes

- Passwords are hashed using Node's built-in `crypto` module (scrypt)
- `db.json` and `uploads/` are gitignored and never pushed to the repo
- The primary admin account (id 1) cannot be deleted
- Sessions auto-expire after 30 minutes of inactivity
