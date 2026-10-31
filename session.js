(function () {
    var TIMEOUT_MS = 30 * 60 * 1000;
    var timer;
    function reset() {
        clearTimeout(timer);
        timer = setTimeout(function () {
            localStorage.removeItem("user");
            window.location.href = "login.html";
        }, TIMEOUT_MS);
    }
    ["click", "keydown", "mousemove", "scroll", "touchstart"].forEach(function (evt) {
        document.addEventListener(evt, reset, { passive: true });
    });
    reset();
})();
