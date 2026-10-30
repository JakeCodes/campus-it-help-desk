const registerForm = document.getElementById("registerForm");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorMessage.textContent = "";
    successMessage.textContent = "";

    const password = document.getElementById("password").value;
    if (password !== document.getElementById("confirmPassword").value) {
        errorMessage.textContent = "Passwords don't match.";
        return;
    }

    // Adds a new student to db.json (the server makes every sign-up a student)
    const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            password: password,
            role: "student"
        })
    });

    const result = await response.json();
    if (!response.ok) {
        errorMessage.textContent = result.error;
        return;
    }

    // Log them straight in and take them to their requests
    localStorage.setItem("user", JSON.stringify(result));
    successMessage.textContent = "Account created! Taking you to your requests...";
    setTimeout(function () {
        window.location.href = "student.html";
    }, 1200);
});
