const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

const nameInput = document.getElementById("name");
const errorMessage = document.getElementById("errorMessage");
const successMessage = document.getElementById("successMessage");

if (user) {
    nameInput.value = user.name;
    const back = user.role === "admin" ? "admin.html" : "student.html";
    document.getElementById("backLink").innerHTML = `<a href="${back}">Back to ${user.role === "admin" ? "admin panel" : "my requests"}</a>`;
}

document.getElementById("profileForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    errorMessage.textContent = "";
    successMessage.textContent = "";

    const res = await fetch("/api/users/" + user.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: nameInput.value.trim(),
            currentPassword: document.getElementById("currentPassword").value,
            newPassword: document.getElementById("newPassword").value || undefined
        })
    });

    const result = await res.json();
    if (!res.ok) {
        errorMessage.textContent = result.error;
        return;
    }

    user.name = result.name;
    localStorage.setItem("user", JSON.stringify(user));
    successMessage.textContent = "Profile updated successfully.";
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
});

function logout() {
    localStorage.removeItem("user");
    window.location.href = "login.html";
}
