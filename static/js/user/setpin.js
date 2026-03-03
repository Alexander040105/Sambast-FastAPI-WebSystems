const inputs = document.querySelectorAll('.pin-container input');
const form = document.getElementById('setPinForm');

inputs.forEach((input, index) => {
    // Move to next input once a digit is entered
    input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });

    // Move to previous input on backspace
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            inputs[index - 1].focus();
        }
    });
});

// Capture and Save PIN to localStorage
form.addEventListener('submit', () => {
    let pin = "";
    inputs.forEach(input => pin += input.value);
    localStorage.setItem('userPin', pin);
});