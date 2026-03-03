const inputs = document.querySelectorAll('.pin-container input');
const form = document.getElementById('verifyPinForm');

// Handle input focus and backspace navigation
inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            inputs[index - 1].focus();
        }
    });
});

// Verify PIN logic
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let enteredPin = "";
    inputs.forEach(input => enteredPin += input.value);
    
    // Retrieve the PIN saved from the Set PIN page
    const savedPin = localStorage.getItem('userPin');

    if (enteredPin === savedPin) {
        // Success: Navigate to the home page
        window.location.href = "shophomepage.html";
    } else {
        // Error: Alert the user and reset the inputs
        alert("PINs do not match. Please try again.");
        inputs.forEach(input => input.value = "");
        inputs[0].focus();
    }
});