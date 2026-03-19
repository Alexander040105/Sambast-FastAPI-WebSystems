const inputs = document.querySelectorAll('.pin-container input');
const form = document.querySelector('.auth-form');

inputs.forEach((input, index) => {
    // Auto-focus move forward
    input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });

    // Auto-focus move backward on Backspace
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
            inputs[index - 1].focus();
        }
    });
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let enteredPin = "";
    inputs.forEach(input => enteredPin += input.value);
    
    const savedPin = localStorage.getItem('userPin');

    if (!savedPin) {
        alert("No account found. Please register first.");
        window.location.href = "index.html";
        return;
    }

    if (enteredPin === savedPin) {
        window.location.href = "shophomepage.html";
    } else {
        alert("Incorrect PIN.");
        inputs.forEach(input => input.value = "");
        inputs[0].focus();
    }
});