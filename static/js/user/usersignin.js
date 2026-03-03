const inputs = document.querySelectorAll('.pin-container input');
const form = document.querySelector('.auth-form');

// Handle auto-focus navigation between PIN boxes
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

// Sign-In Validation Logic
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    let enteredPin = "";
    inputs.forEach(input => enteredPin += input.value);
    
    // Retrieve the registered PIN from localStorage
    const savedPin = localStorage.getItem('userPin');

    if (!savedPin) {
        alert("No account found. Please create an account first.");
        window.location.href = "createacc.html";
        return;
    }

    if (enteredPin === savedPin) {
        // Success: Redirect to shop homepage
        window.location.href = "shophomepage.html";
    } else {
        // Failure: Shake effect or alert and clear
        alert("Incorrect PIN. Please try again.");
        inputs.forEach(input => input.value = "");
        inputs[0].focus();
    }
});