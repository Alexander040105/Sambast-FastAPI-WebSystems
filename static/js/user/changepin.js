document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('changePinForm');
    const errorDisplay = document.getElementById('errorMessage');
    const pinInputs = document.querySelectorAll('.pin-container input');

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
        e.preventDefault();

        let pin = '';
        pinInputs.forEach(input => pin += input.value);

        if (pin.length !== 4) {
            errorDisplay.textContent = 'Please enter all 4 digits of your PIN.';
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Updating PIN...';
        errorDisplay.textContent = '';

        fetch('/change-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_pin: pin })
        })
        .then(response => response.json().then(data => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
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
