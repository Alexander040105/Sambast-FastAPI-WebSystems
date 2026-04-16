/* SIDEBAR MENU - Always works correctly */
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

if (menuBtn && sidebar && closeBtn && overlay) {
    menuBtn.addEventListener("click", () => {
        sidebar.classList.add("open");
        overlay.classList.add("show");
    });
    
    closeBtn.addEventListener("click", closeMenu);
    overlay.addEventListener("click", closeMenu);
    
    function closeMenu() {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
    }
}

/* FORM SUBMISSION - Let backend handle filtering and updates */
/* Forms are already configured with correct POST routes and status parameters */
/* No client-side interception needed - forms submit normally */

/* OPTIONAL: Add visual feedback while forms process */
document.querySelectorAll("form").forEach(form => {
    form.addEventListener("submit", function() {
        const submitBtn = this.querySelector("button[type='submit']");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Processing...";
        }
    });
});