# Campus IT Help Desk

A simple help desk site where students submit IT support requests and IT staff manage them.

## Run it

Needs [Node.js](https://nodejs.org/). No packages to install.

```
node server.js
```

Then open http://localhost:3000

## Logins

- **Admin:** `admin@campus.edu` / `admin123`
- **Students:** create an account with "Create Student Account" on the homepage.

## Files

- `server.js` – the web server and API
- `db.json` – the database (users and tickets)
- `index.html` – homepage
- `login.html`, `register.html` – sign in / sign up
- `student.html`, `new-request.html` – student pages
- `admin.html` – view all requests, change status, add users
- `pages.css` – styles
