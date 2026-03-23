function renderHistory(orders) {
    const container = document.getElementById('orderHistoryList');
    if (!container) return;
    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = '<p style="text-align:center; margin-top:50px; color:#666;">No orders yet.</p>';
        return;
    }

    orders.forEach(order => {
        order.items.forEach(item => {
            const total = item.price_at_time * item.qty;
            const card  = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="item-img-placeholder">image</div>
                <div class="order-info">
                    <h2 class="product-name">${item.name}</h2>
                    <p class="amount-label">Product Amount: ₱${item.price_at_time}</p>
                    <p class="qty-summary">Qty: ${item.qty}</p>
                    <p class="total-amount">Total Amount: ₱${total}</p>
                    <p class="order-no">Order no: ${order.order_no}</p>
                    <p class="order-status">Status: ${order.status}</p>
                    <button class="buy-again-btn" onclick="buyAgain('${order.order_no}', ${JSON.stringify(item).replace(/'/g, "\\'")})">BUY AGAIN</button>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

function buyAgain(orderNo, item) {
    const itemToBuy = [{
        product_id: null,  // product_id not needed for display
        name : item.name,
        price: item.price_at_time,
        qty  : item.qty
    }];
    localStorage.setItem('checkoutItems', JSON.stringify(itemToBuy));
    window.location.href = '/checkout';
}

document.addEventListener('DOMContentLoaded', () => {
    fetch('/orders/history')
        .then(res => res.json())
        .then(orders => renderHistory(orders))
        .catch(() => {
            const container = document.getElementById('orderHistoryList');
            if (container) container.innerHTML =
                '<p style="text-align:center; margin-top:50px; color:#666;">Failed to load history.</p>';
        });
});