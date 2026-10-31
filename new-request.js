const user = JSON.parse(localStorage.getItem("user"));
if (!user) window.location.href = "login.html";

// KB suggestions on title input
var kbArticles = [];
fetch("/api/kb").then(function(r){ return r.json(); }).then(function(list){ kbArticles = list; });
document.addEventListener("DOMContentLoaded", function(){
    var titleInput = document.getElementById("title");
    var suggestBox = document.getElementById("kb-suggestions");
    var resultsBox = document.getElementById("kb-results");
    if (!titleInput || !suggestBox || !resultsBox) return;
    titleInput.addEventListener("input", function(){
        var q = titleInput.value.trim().toLowerCase();
        if (!q || q.length < 3 || kbArticles.length === 0) { suggestBox.style.display = "none"; return; }
        var matches = kbArticles.filter(function(a){ return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q); }).slice(0, 4);
        if (!matches.length) { suggestBox.style.display = "none"; return; }
        resultsBox.innerHTML = "";
        matches.forEach(function(a){
            var item = document.createElement("div");
            item.className = "kb-suggestion-item";
            item.textContent = a.title;
            item.addEventListener("click", function(){
                var modal = document.createElement("div");
                modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center";
                var box = document.createElement("div");
                box.style.cssText = "background:#fff;color:#333;border-radius:8px;padding:24px;max-width:560px;width:90%;max-height:70vh;overflow-y:auto";
                box.innerHTML = '<h3 style="margin-top:0">'+a.title+'</h3><p style="white-space:pre-wrap;font-size:14px;line-height:1.6">'+a.content+'</p><button style="margin-top:12px;padding:6px 16px;cursor:pointer;border:1px solid #ccc;border-radius:4px">Close</button>';
                box.querySelector("button").addEventListener("click", function(){ document.body.removeChild(modal); });
                modal.addEventListener("click", function(e){ if(e.target===modal) document.body.removeChild(modal); });
                modal.appendChild(box); document.body.appendChild(modal);
            });
            resultsBox.appendChild(item);
        });
        suggestBox.style.display = "block";
    });
});

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
