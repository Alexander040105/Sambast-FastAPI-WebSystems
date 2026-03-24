document.addEventListener('DOMContentLoaded', () => {
    const listContainer    = document.getElementById('checkoutList');
    const finalTotalDisplay = document.getElementById('finalTotal');
    const orderNumDisplay  = document.getElementById('tempOrderNo');

    if (orderNumDisplay) orderNumDisplay.innerText = "Generating...";

    const checkoutItems = JSON.parse(localStorage.getItem('checkoutItems')) || [];
    let currentTotal = 0;

    if (checkoutItems.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">No items selected.</p>';
    } else {
        listContainer.innerHTML = '';
        checkoutItems.forEach(item => {
            const itemTotal  = item.price * item.qty;
            currentTotal    += itemTotal;

            const div = document.createElement('div');
            div.className = 'checkout-item';
            div.innerHTML = `
                <div class="checkout-img">image</div>
                <div class="item-details">
                    <h2 class="item-name">${item.name}</h2>
                    <div class="tag-row">
                        <span class="mini-tag">Qty: ${item.qty}</span>
                    </div>
                    <p class="item-amount">Product Amount: ₱${itemTotal}</p>
                </div>
            `;
            listContainer.appendChild(div);
        });
    }

    if (finalTotalDisplay) finalTotalDisplay.innerText = currentTotal === 0 ? "0" : currentTotal;

    const placeOrderBtn = document.getElementById('placeOrderBtn');
    if (placeOrderBtn) {
        placeOrderBtn.onclick = () => {
            if (checkoutItems.length === 0) {
                alert("No items to order.");
                return;
            }

            const paymentInput = document.querySelector('input[name="payment_method"]:checked');
            const paymentMethod = paymentInput ? paymentInput.value : 'cash';

            placeOrderBtn.style.pointerEvents = 'none';
            placeOrderBtn.style.opacity = '0.6';
            placeOrderBtn.innerText = "Placing Order...";

            fetch('/orders', {
                method : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body   : JSON.stringify({
                    items          : checkoutItems,
                    payment_method : paymentMethod
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    // Save for progress page
                    localStorage.setItem('lastOrderItems', JSON.stringify(checkoutItems));
                    localStorage.setItem('lastOrderTotal', currentTotal);
                    localStorage.setItem('lastOrderNo', data.order_no);

                    // Clean up cart
                    localStorage.removeItem('checkoutItems');
                    localStorage.removeItem('cart');

                    alert("Order Successfully Placed!");
                    window.location.href = '/order-progress';
                } else {
                    alert("Failed to place order: " + (data.error || "Unknown error"));
                    placeOrderBtn.style.pointerEvents = 'auto';
                    placeOrderBtn.style.opacity = '1';
                    placeOrderBtn.innerText = "PLACE ORDER";
                }
            })
            .catch(() => {
                alert("Network error. Please try again.");
                placeOrderBtn.style.pointerEvents = 'auto';
                placeOrderBtn.style.opacity = '1';
                placeOrderBtn.innerText = "PLACE ORDER";
            });
        };
    }
});