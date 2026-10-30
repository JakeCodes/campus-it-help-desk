// Who is logged in? (saved by login.js)
const user = JSON.parse(localStorage.getItem("user"));
if (!user) {
    window.location.href = "login.html";
}

const form = document.getElementById("requestForm");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");
const submitButton = document.getElementById("submitButton");

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    errorMessage.textContent = "";
    successMessage.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    const ticket = {
        email: user.email,
        title: document.getElementById("title").value.trim(),
        category: document.getElementById("category").value,
        description: document.getElementById("description").value.trim()
    };

    try {
        const response = await fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ticket)
        });

        if (!response.ok) {
            throw new Error("Server responded with " + response.status);
        }

        successMessage.textContent = "Request submitted! Taking you back to your requests...";
        form.reset();
        setTimeout(function () {
            window.location.href = "student.html";
        }, 1500);
    } catch (error) {
        console.error(error);
        errorMessage.textContent = "Could not submit your request. Please try again.";
        submitButton.disabled = false;
        submitButton.textContent = "Submit Request";
    }
});

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}
