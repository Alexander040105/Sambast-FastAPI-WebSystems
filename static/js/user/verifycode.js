const inputs = document.querySelectorAll('.otp-container input');
const resendBtn = document.querySelector('.resend-btn');

// Handle auto-focusing between inputs
inputs.forEach((input, index) => {
    // Move forward when a digit is entered
    input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });

    // Move backward on Backspace if the current field is empty
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            inputs[index - 1].focus();
        }
    });
});

// Resend Code Logic
resendBtn.addEventListener('click', () => {
    // Add your OTP resend logic here (e.g., API call)
    alert("A new verification code has been sent to your phone.");
    
    // Optional: Add a cooldown timer to the button
    resendBtn.disabled = true;
    setTimeout(() => {
        resendBtn.disabled = false;
    }, 60000); // 60 second cooldown
});