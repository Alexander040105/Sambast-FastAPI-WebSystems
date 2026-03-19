document.addEventListener('DOMContentLoaded', () => {
    const itemsContainer = document.getElementById('orderItemsList');
    const totalDisplay = document.getElementById('progressTotal');
    const statusText = document.getElementById('statusText');
    const statusDesc = document.getElementById('statusDesc');
    const backBtn = document.getElementById('backToShopBtn');
    
    const lastTotal = localStorage.getItem('lastOrderTotal');
    const lastItemsData = localStorage.getItem('lastOrderItems');
    const lastItems = JSON.parse(lastItemsData) || [];

    totalDisplay.innerText = lastTotal ? lastTotal : "0000";

    function checkStatus() {
        const currentStatus = localStorage.getItem('orderStatus') || 'Preparing';
        statusText.innerText = currentStatus;

        // Logic to show button ONLY when admin marks as completed
        if (currentStatus === 'completed' || currentStatus === 'Completed') {
            statusText.innerText = "COMPLETED";
            statusDesc.innerText = "Your order has been picked up. Thank you!";
            statusText.style.color = "#28a745"; 
            backBtn.style.display = "block"; // Show the button now
        } else if (currentStatus === 'Ready for Pick-up') {
            statusDesc.innerText = "Your order is ready! Please head to the store and show your order number.";
            statusText.style.color = "#28a745"; 
            backBtn.style.display = "none"; // Keep hidden
        } else {
            statusDesc.innerText = "Your order is being prepared. We'll notify you when it's ready for pick-up!";
            statusText.style.color = "#1A323E";
            backBtn.style.display = "none"; // Keep hidden
        }
    }

    checkStatus();
    setInterval(checkStatus, 2000);

    if (lastItems.length > 0) {
        itemsContainer.innerHTML = ''; 
        lastItems.forEach(item => {
            const itemRow = document.createElement('div');
            itemRow.className = 'detail-item';
            itemRow.innerHTML = `
                <span>${item.qty}x ${item.name}</span>
                <strong>${item.price * item.qty}</strong>
            `;
            itemsContainer.appendChild(itemRow);
        });
    }
});