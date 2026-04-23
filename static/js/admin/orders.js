/* SIDEBAR MENU */
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

/* CANCEL ORDER MODAL */

const cancelModal = document.getElementById("cancelReasonModal");
const cancelTextarea = document.getElementById("cancelReasonText");
const confirmCancelBtn = document.getElementById("confirmCancelOrder");
const closeCancelModalBtn = document.getElementById("closeCancelModal");

let activeCancelForm = null;

document.querySelectorAll(".open-cancel-modal").forEach(button => {
    button.addEventListener("click", function () {
        activeCancelForm = this.closest(".cancel-order-form");

        if (cancelModal) {
            cancelModal.classList.add("show");
            cancelTextarea.value = "";
        }
    });
});

if (closeCancelModalBtn) {
    closeCancelModalBtn.addEventListener("click", () => {
        cancelModal.classList.remove("show");
        activeCancelForm = null;
    });
}

if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener("click", () => {
        if (!activeCancelForm) return;

        const hiddenInput = activeCancelForm.querySelector(".cancel-reason-input");

        if (hiddenInput) {
            hiddenInput.value = cancelTextarea.value.trim();
        }

        activeCancelForm.submit();
    });
}

/* FORM SUBMISSION FEEDBACK */

document.querySelectorAll("form").forEach(form => {
    form.addEventListener("submit", function () {
        const submitBtn = this.querySelector("button[type='submit']");

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Processing...";
        }
    });
});