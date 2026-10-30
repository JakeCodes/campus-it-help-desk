const loginForm = document.getElementById("loginForm");
const errorMessage = document.getElementById("errorMessage");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorMessage.textContent = "";

    const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value
        })
    });

    if (!response.ok) {
        errorMessage.textContent = "Wrong email or password.";
        return;
    }

    // Remember who is logged in, then send them to their page
    const user = await response.json();
    localStorage.setItem("user", JSON.stringify(user));
    window.location.href = user.role === "admin" ? "admin.html" : "student.html";
});
