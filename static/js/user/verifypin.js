document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('verifyPinForm');
    const pinInputs = document.querySelectorAll('.pin-container input');

    // Auto-advance / backspace navigation for PIN
    pinInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < pinInputs.length - 1) {
                pinInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                pinInputs[index - 1].focus();
            }
        });
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault(); // Stop default form submission

        let pin = '';
        pinInputs.forEach(input => pin += input.value);

        if (pin.length !== 4) {
            showErrorModal('Please enter all 4 digits to verify your PIN.');

            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Verifying...';

        fetch('/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pin })
        })
        .then(response => response.json().then(data => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
            if (ok) {
                // Success
                window.location.href = data.redirect_url;
            } else {
                // Error
                showErrorModal(data.error || 'An unknown error occurred.');

            }
        })
        .catch(err => {
            console.error('Fetch Error:', err);
            showErrorModal('A network error occurred. Please try again.');

        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'VERIFY PIN';
        });
    });
});
function showErrorModal(message) {
    const modal = document.getElementById("errorModal");
    const text = document.getElementById("modalErrorText");
    const okBtn = document.getElementById("modalOkBtn");

    text.textContent = message;
    modal.style.display = "flex";

    const closeModal = () => {
        modal.style.display = "none";
    };

    okBtn.onclick = closeModal;

    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

