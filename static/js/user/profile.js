document.addEventListener('DOMContentLoaded', () => {
    const editBtn = document.getElementById('editContactBtn');

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            // Redirects to verifycode.html when pencil is clicked
            window.location.href = 'verifycode.html';
        });
    }

    // Load Pet Profile
    fetch('/api/user/pet')
        .then(response => response.json())
        .then(data => {
            if (data && !data.error && Object.keys(data).length > 0) {
                document.getElementById('petName').value = data.name || '';
                document.getElementById('petSpecies').value = data.species || '';
                document.getElementById('petBreed').value = data.breed || '';
                document.getElementById('petAge').value = data.age_months || '';
                document.getElementById('petWeight').value = data.weight_kg || '';
            }
        })
        .catch(error => console.error('Error fetching pet profile:', error));

    // Handle Pet Profile Form Submission
    const petProfileForm = document.getElementById('petProfileForm');
    if (petProfileForm) {
        petProfileForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const formData = new FormData(petProfileForm);
            const petData = {
                name: formData.get('name'),
                species: formData.get('species'),
                breed: formData.get('breed'),
                age_months: parseInt(formData.get('age_months')),
                weight_kg: parseFloat(formData.get('weight_kg'))
            };

            const submitBtn = petProfileForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;

            fetch('/api/user/pet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(petData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Pet profile saved successfully!');
                } else {
                    alert(data.error || 'Failed to save pet profile.');
                }
            })
            .catch(error => {
                console.error('Error saving pet profile:', error);
                alert('An error occurred while saving.');
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
        });
    }
});