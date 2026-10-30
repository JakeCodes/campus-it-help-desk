// Who is logged in? (saved by login.js)
const user = JSON.parse(localStorage.getItem("user"));
if (!user) {
    window.location.href = "login.html";
}

const requestList = document.getElementById("request-list");

async function loadTickets() {
    const response = await fetch("/api/tickets?email=" + encodeURIComponent(user.email));
    const tickets = await response.json();

    if (tickets.length === 0) {
        requestList.innerHTML = "<p>No IT requests found.</p>";
        return;
    }

    requestList.innerHTML = "";
    tickets.forEach(function (ticket) {
        const card = document.createElement("div");
        card.innerHTML = `
            <h3></h3>
            <p><strong>Category:</strong> <span class="category"></span></p>
            <p><strong>Status:</strong> <span class="status"></span></p>
            <p class="description"></p>
        `;
        // textContent keeps anything typed into the form from being run as HTML
        card.querySelector("h3").textContent = ticket.title;
        card.querySelector(".category").textContent = ticket.category;
        card.querySelector(".status").textContent = ticket.status;
        card.querySelector(".description").textContent = ticket.description;
        requestList.appendChild(card);
    });
}

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

if (user) {
    document.querySelector(".card h2").textContent = user.name + "'s IT Requests";
    loadTickets();
}
