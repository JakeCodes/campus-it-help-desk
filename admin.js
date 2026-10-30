// Only admins may be here (saved by login.js)
const user = JSON.parse(localStorage.getItem("user"));
if (!user || user.role !== "admin") {
    window.location.href = "login.html";
}

const requestList = document.getElementById("request-list");
const userList = document.getElementById("user-list");
const userForm = document.getElementById("userForm");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");

const STATUSES = ["Open", "In Progress", "Resolved"];

async function loadTickets() {
    const response = await fetch("/api/tickets");
    const tickets = await response.json();

    if (tickets.length === 0) {
        requestList.innerHTML = "<p>No IT requests yet.</p>";
        return;
    }

    requestList.innerHTML = "";
    tickets.forEach(function (ticket) {
        const card = document.createElement("div");
        card.innerHTML = `
            <h3></h3>
            <p><strong>From:</strong> <span class="from"></span></p>
            <p><strong>Category:</strong> <span class="category"></span></p>
            <p class="description"></p>
            <p><strong>Status:</strong> <select class="status"></select></p>
        `;
        card.querySelector("h3").textContent = ticket.title;
        card.querySelector(".from").textContent = ticket.studentName;
        card.querySelector(".category").textContent = ticket.category;
        card.querySelector(".description").textContent = ticket.description;

        // Dropdown to change the status; saves as soon as you pick one
        const statusSelect = card.querySelector(".status");
        STATUSES.forEach(function (status) {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            option.selected = status === ticket.status;
            statusSelect.appendChild(option);
        });
        statusSelect.addEventListener("change", function () {
            fetch("/api/tickets/" + ticket.id, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: statusSelect.value })
            });
        });

        requestList.appendChild(card);
    });
}

async function loadUsers() {
    const response = await fetch("/api/users");
    const users = await response.json();

    userList.innerHTML = "";
    users.forEach(function (u) {
        const item = document.createElement("li");
        item.textContent = u.name + " (" + u.email + ") - " + u.role;
        userList.appendChild(item);
    });
}

userForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorMessage.textContent = "";
    successMessage.textContent = "";

    const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value,
            role: document.getElementById("role").value
        })
    });

    const result = await response.json();
    if (!response.ok) {
        errorMessage.textContent = result.error;
        return;
    }

    successMessage.textContent = result.name + " was added.";
    userForm.reset();
    loadUsers();
});

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

if (user && user.role === "admin") {
    loadTickets();
    loadUsers();
}
