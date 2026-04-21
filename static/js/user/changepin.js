document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('changePinForm');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const oldPin = document.querySelector('input[name="old_pin"]').value;
        const newPin = document.querySelector('input[name="new_pin"]').value;
        const confirmPin = document.querySelector('input[name="confirm_pin"]').value;

        if (!oldPin || !newPin || !confirmPin) {
            showErrorModal('Please fill out all PIN fields.');
            return;
        }

        if (oldPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
            showErrorModal('All PINs must be exactly 4 digits.');
            return;
        }

        if (oldPin === newPin) {
            showErrorModal('New PIN cannot be the same as old PIN.');
            return;
        }

        if (newPin !== confirmPin) {
            showErrorModal('New PINs do not match. Please try again.');
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Updating PIN...';

        fetch('/change-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                old_pin: oldPin,
                new_pin: newPin,
                confirm_pin: confirmPin
            })
        })
        .then(response => response.json().then(data => ({ ok: response.ok, data })))
        .then(({ ok, data }) => {
            if (ok) {
                showNotification('Success', 'PIN updated successfully');
                setTimeout(() => {
                    window.location.href = '/profile';
                }, 1200);
            } else {
                showErrorModal(data.error || 'An unknown error occurred.');
            }
        })
        .catch(() => {
            showErrorModal('A network error occurred. Please try again.');
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'UPDATE PIN';
        });
    });
});
let notificationTimeout;

function showNotification(title, message) {
    const notif = document.getElementById('notification');

    document.querySelector('.notif-title').innerText = title;
    document.querySelector('.notif-msg').innerText = message;

    notif.classList.remove('show');
    void notif.offsetHeight;
    notif.classList.add('show');

    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
        hideNotification();
    }, 3000);
}

function hideNotification() {
    const notif = document.getElementById('notification');
    notif.classList.remove('show');
}
function showErrorModal(message) {
    const modal = document.getElementById("errorModal");
    const text = document.getElementById("modalErrorText");
    const okBtn = document.getElementById("modalOkBtn");

    if (!modal || !text || !okBtn) return;

    text.textContent = message;
    modal.style.display = "flex";

    okBtn.onclick = () => {
        modal.style.display = "none";
    };

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    };
}