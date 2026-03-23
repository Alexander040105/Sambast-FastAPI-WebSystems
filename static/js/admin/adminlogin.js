document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('adminLoginForm'); // Assumes the form has this ID
    const errorDisplay = document.getElementById('errorMessage');   // Assumes an element with this ID exists for errors

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Stop the default form submission

            const username = document.getElementById('username').value; // Assumes input has this ID
            const password = document.getElementById('password').value; // Assumes input has this ID
            const submitButton = loginForm.querySelector('button[type="submit"]');

            // Basic validation
            if (!username || !password) {
                if (errorDisplay) errorDisplay.textContent = 'Please enter both username and password.';
                return;
            }

            // UI feedback
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Signing In...';
            }
            if (errorDisplay) errorDisplay.textContent = '';


            fetch('/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            })
            .then(response => response.json().then(data => ({ ok: response.ok, data })))
            .then(({ ok, data }) => {
                if (ok) {
                    // On success, redirect
                    window.location.href = data.redirect_url;
                } else {
                    // On error, display message
                    if (errorDisplay) errorDisplay.textContent = data.error || 'An unknown error occurred.';
                }
            })
            .catch(err => {
                console.error('Fetch Error:', err);
                if (errorDisplay) errorDisplay.textContent = 'A network error occurred. Please try again.';
            })
            .finally(() => {
                // Re-enable the button
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'SIGN IN';
                }
            });
        });
    }
});
