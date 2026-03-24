document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('changePinForm');
    const errorDisplay = document.getElementById('errorMessage');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const oldPin = document.querySelector('input[name="old_pin"]').value;
        const newPin = document.querySelector('input[name="new_pin"]').value;
        const confirmPin = document.querySelector('input[name="confirm_pin"]').value;

        if (!oldPin || !newPin || !confirmPin) {
            errorDisplay.textContent = 'Please fill out all PIN fields.';
            return;
        }

        if (oldPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
            errorDisplay.textContent = 'All PINs must be exactly 4 digits.';
            return;
        }

        if (newPin !== confirmPin) {
            errorDisplay.textContent = 'New PINs do not match. Please try again.';
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Updating PIN...';
        errorDisplay.textContent = '';

        fetch('/change-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                old_pin: oldPin,
                new_pin: newPin,
                confirm_pin: confirmPin
            })
        })
        .then(response => response.json().then(data => ({ ok: response.ok, status: response.status, data })))
        .then(({ ok, status, data }) => {
            if (ok) {
                alert('PIN Updated Successfully');
                window.location.href = '/profile';
            } else {
                errorDisplay.textContent = data.error || 'An unknown error occurred.';
            }
        })
        .catch(err => {
            console.error('Fetch Error:', err);
            errorDisplay.textContent = 'A network error occurred. Please try again.';
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'UPDATE PIN';
        });
    });
});
