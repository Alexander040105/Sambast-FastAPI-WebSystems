document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createAccountForm');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const fullName = document.getElementById('fullName').value.trim();
        const contactNo = document.getElementById('contactNo').value.trim();

        // EMPTY FIELDS
        if (!fullName || !contactNo) {
            showErrorModal('Please fill in all fields.');
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Creating...';

        fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                full_name: fullName,
                contact_no: contactNo
            })
        })
        .then(response =>
            response.json().then(data => ({
                ok: response.ok,
                status: response.status,
                data
            }))
        )
        .then(({ ok, status, data }) => {

            if (ok) {
                window.location.href = data.redirect_url;
            } else {
                showErrorModal(data.error || `An error occurred (Status: ${status})`);
            }

        })
        .catch(err => {
            console.error('Fetch Error:', err);
            showErrorModal('A network error occurred. Please try again.');
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'VERIFY';
        });
    });
});


// ===== ERROR MODAL FUNCTION =====
function showErrorModal(message) {
    const modal = document.getElementById("errorModal");
    const text = document.getElementById("modalErrorText");
    const okBtn = document.getElementById("modalOkBtn");

    text.textContent = message;
    modal.style.display = "flex";

    // prevent duplicate event stacking
    okBtn.onclick = null;
    modal.onclick = null;

    okBtn.onclick = function () {
        modal.style.display = "none";
    };

    modal.onclick = function (e) {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    };
}
