document.addEventListener('DOMContentLoaded', () => {
    const itemsContainer = document.getElementById('orderItemsList');
    const totalDisplay   = document.getElementById('progressTotal');
    const statusText     = document.getElementById('statusText');
    const statusDesc     = document.getElementById('statusDesc');
    const orderNoDisplay = document.getElementById('orderNoDisplay');

    // Load saved data from checkout
    const lastTotal = localStorage.getItem('lastOrderTotal');
    const lastItems = JSON.parse(localStorage.getItem('lastOrderItems')) || [];
    const lastOrderNo = localStorage.getItem('lastOrderNo');

    if (totalDisplay) totalDisplay.innerText = lastTotal || "0";
    if (orderNoDisplay && lastOrderNo) orderNoDisplay.innerText = lastOrderNo;

    // Render items list
    if (lastItems.length > 0 && itemsContainer) {
        itemsContainer.innerHTML = '';
        lastItems.forEach(item => {
            const row = document.createElement('div');
            row.className = 'detail-item';
            row.innerHTML = `
                <span>${item.qty}x ${item.name}</span>
                <strong>₱${item.price * item.qty}</strong>
            `;
            itemsContainer.appendChild(row);
        });
    }

    function updateStatusUI(status) {
        if (!statusText) return;
        statusText.innerText = status;

        if (status === 'Ready') {
            statusDesc.innerText = "Your order is ready! Please head to the store and show your order number.";
            statusText.style.color = "#28a745";
        } else if (status === 'Completed') {
            statusDesc.innerText = "Order completed. Thank you for your purchase!";
            statusText.style.color = "#28a745";
        } else if (status === 'Cancelled') {
            statusDesc.innerText = "Your order has been cancelled. Please contact the shop for assistance.";
            statusText.style.color = "#dc3545";
        } else {
            statusDesc.innerText = "Your order is being prepared. We'll notify you when it's ready for pick-up!";
            statusText.style.color = "#000000";
        }
    }

    function pollStatus() {
        fetch('/orders/latest/status')
            .then(res => res.json())
            .then(data => {
                if (data.status) updateStatusUI(data.status);
            })
            .catch(() => {}); // Fail silently on network error
    }

    pollStatus();
    setInterval(pollStatus, 5000); // Poll every 5 seconds
});