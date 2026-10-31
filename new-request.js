const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

const form = document.getElementById("requestForm");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");
const submitButton = document.getElementById("submitButton");

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();
    errorMessage.textContent = "";
    successMessage.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    const fileInput = document.getElementById("attachment");
    const file = fileInput.files[0];

    if (file && file.size > 5 * 1024 * 1024) {
        errorMessage.textContent = "Attachment must be under 5 MB.";
        submitButton.disabled = false;
        submitButton.textContent = "Submit Request";
        return;
    }

    let attachment = null;
    if (file) {
        const data = await readFileAsBase64(file);
        attachment = { name: file.name, data };
    }

    const ticket = {
        email: user.email,
        title: document.getElementById("title").value.trim(),
        category: document.getElementById("category").value,
        priority: document.getElementById("priority").value,
        description: document.getElementById("description").value.trim(),
        attachment
    };

    try {
        const response = await fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ticket)
        });

        if (!response.ok) throw new Error("Server responded with " + response.status);

        successMessage.textContent = "Request submitted! Taking you back to your requests...";
        form.reset();
        setTimeout(() => { window.location.href = "student.html"; }, 1500);
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
