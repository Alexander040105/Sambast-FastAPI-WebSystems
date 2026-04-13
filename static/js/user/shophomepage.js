var data = [];
var currentCheckout = [];
var cartSet = new Set();
var globalQty = 0;
var globalPrice = 0;

function render(list) {
    var grid = document.getElementById('itemGrid');
    grid.innerHTML = "";
    for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var imgSrc = p.image_filename
            ? '/static/uploads/' + p.image_filename
            : '/static/img/user/user-male-circle.png';
        var div = document.createElement('div');
        div.className = "product-card";
        div.id = "p-" + p.product_id;
        div.innerHTML = `
            <div class="flip-inner">
                <div class="front-face" onclick="toggle(${p.product_id})">
                    <div class="img-box"><img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;"></div>
                    <p class="label-cat">${p.category}</p>
                    <h2 class="label-name">${p.name}</h2>
                    <div class="input-row" onclick="event.stopPropagation()">
                        <div class="qty-box">
                            <button onclick="qtyChange(${p.product_id},-1)">-</button>
                            <span id="qval-${p.product_id}">1</span>
                            <button onclick="qtyChange(${p.product_id},1)">+</button>
                        </div>
                    </div>
                    <p class="label-price">Product Amount: ₱${p.price}</p>
                    <div class="btn-row" onclick="event.stopPropagation()">
                        <button class="cart-act" onclick="addCart(${p.product_id},${p.price})">CART</button>
                        <button class="buy-act" onclick="buyNow(${p.product_id})">BUY</button>
                    </div>
                </div>
                <div class="back-face" onclick="toggle(${p.product_id})">
                    <h3>${p.name}</h3>
                    <p style="font-size:12px; margin-top:10px;">Description</p>
                    <p style="font-size:10px; opacity:0.8; margin-top:5px;">${p.description || 'No description available.'}</p>
                </div>
            </div>`;
        grid.appendChild(div);
    }
}

function toggle(id) {
    document.getElementById("p-" + id).classList.toggle('is-flipped');
}

function qtyChange(id, d) {
    var el = document.getElementById("qval-" + id);
    var v = parseInt(el.innerText) + d;
    if (v >= 1) el.innerText = v;
}

function addCart(id, pr) {
    var q       = parseInt(document.getElementById("qval-" + id).innerText);
    var product = data.find(p => p.product_id === id);

    cartSet.add(id);
    globalQty   += q;
    globalPrice += (pr * q);

    var bottomBar = document.querySelector('.bottom-bar');
    if (bottomBar) bottomBar.style.display = 'flex';

    document.getElementById('cartCount').innerText = cartSet.size;

    var btnQtyEl = document.getElementById('btnQty');
    if (btnQtyEl) btnQtyEl.innerText = globalQty;

    var subTotalEl = document.getElementById('displaySubtotal') || document.getElementById('subTotal');
    if (subTotalEl) subTotalEl.innerText = globalPrice === 0 ? "0000" : globalPrice;

    var cart = JSON.parse(localStorage.getItem('cart')) || [];
    var existing = cart.find(item => item.product_id === id);
    if (existing) {
        existing.qty += q;
    } else {
        cart.push({ product_id: product.product_id, name: product.name, price: product.price, qty: q });
    }
    localStorage.setItem('cart', JSON.stringify(cart));

    fetchRecommendations({ cart_items: cart });

    alert(product.name + " added to cart!");
}

function buyNow(id) {
    var q       = parseInt(document.getElementById("qval-" + id).innerText);
    var product = data.find(p => p.product_id === id);

    var directItem = [{ product_id: product.product_id, name: product.name, price: product.price, qty: q }];
    localStorage.setItem('checkoutItems', JSON.stringify(directItem));
    window.location.href = '/checkout';
}

function handleCheckout() {
    var cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length === 0) {
        alert("Please add items to cart first!");
        return;
    }
    window.location.href = '/cart';
}

function filterFn(cat, btn) {
    var btns = document.querySelectorAll('.cat-pill');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    var filtered = (cat === 'All') ? data : data.filter(x => x.category === cat);
    render(filtered);
}

function searchFn() {
    var s = document.getElementById('productSearch').value.toLowerCase();
    var results = data.filter(x => x.name.toLowerCase().includes(s));
    render(results);
}

function closeStatusModal() {
    document.getElementById('statusModal').style.display = 'none';
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function fetchRecommendations(cartItems) {
    try {
        const response = await fetch('/api/recommendations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cartItems)
        });

        if (!response.ok) return;

        const recommendations = await response.json();
        if (recommendations && recommendations.length > 0) {
            const container = document.getElementById('ai-recommendations-container');
            const grid = document.getElementById('ai-recommendations-grid');
            
            grid.innerHTML = '';
            
            recommendations.forEach(p => {
                // Ensure the product exists in the global 'data' array
                if (!data.find(item => item.product_id === p.product_id)) {
                    data.push(p);
                }

                var imgSrc = p.image_filename
                    ? '/static/uploads/' + p.image_filename
                    : '/static/img/user/user-male-circle.png';

                const card = document.createElement('div');
                card.className = 'product-card';
                card.id = "p-rec-" + p.product_id;
                card.innerHTML = `
                    <div class="flip-inner">
                        <div class="front-face" onclick="document.getElementById('p-rec-${p.product_id}').classList.toggle('is-flipped')">
                            <div class="img-box">
                                <img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover;">
                            </div>
                            <p class="label-cat">AI Suggestion (${p.category})</p>
                            <h2 class="label-name">${p.name}</h2>
                            <div class="input-row" onclick="event.stopPropagation()">
                                <div class="qty-box">
                                    <button onclick="qtyChangeRec(${p.product_id},-1)">-</button>
                                    <span id="qval-rec-${p.product_id}">1</span>
                                    <button onclick="qtyChangeRec(${p.product_id},1)">+</button>
                                </div>
                            </div>
                            <p class="label-price">Product Amount: ₱${p.price}</p>
                            <div class="btn-row" onclick="event.stopPropagation()">
                                <button class="cart-act" onclick="addCartRec(${p.product_id},${p.price})">CART</button>
                                <button class="buy-act" onclick="buyNowRec(${p.product_id})">BUY</button>
                            </div>
                        </div>
                        <div class="back-face" onclick="document.getElementById('p-rec-${p.product_id}').classList.toggle('is-flipped')">
                            <h3>${p.name}</h3>
                            <p style="font-size:12px; margin-top:10px;">Description</p>
                            <p style="font-size:10px; opacity:0.8; margin-top:5px;">${p.description || 'No description available.'}</p>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
            
            container.style.display = 'block';
        }
    } catch (error) {
        // Silently ignore errors, leaving container hidden
    }
}

function qtyChangeRec(id, d) {
    var el = document.getElementById("qval-rec-" + id);
    var v = parseInt(el.innerText) + d;
    if (v >= 1) el.innerText = v;
}

function addCartRec(id, pr) {
    var q = parseInt(document.getElementById("qval-rec-" + id).innerText);
    var product = data.find(p => p.product_id === id);

    cartSet.add(id);
    globalQty += q;
    globalPrice += (pr * q);

    var bottomBar = document.querySelector('.bottom-bar');
    if (bottomBar) bottomBar.style.display = 'flex';

    document.getElementById('cartCount').innerText = cartSet.size;

    var btnQtyEl = document.getElementById('btnQty');
    if (btnQtyEl) btnQtyEl.innerText = globalQty;

    var subTotalEl = document.getElementById('displaySubtotal') || document.getElementById('subTotal');
    if (subTotalEl) subTotalEl.innerText = globalPrice === 0 ? "0000" : globalPrice;

    var cart = JSON.parse(localStorage.getItem('cart')) || [];
    var existing = cart.find(item => item.product_id === id);
    if (existing) {
        existing.qty += q;
    } else {
        cart.push({ product_id: product.product_id, name: product.name, price: product.price, qty: q });
    }
    localStorage.setItem('cart', JSON.stringify(cart));

    fetchRecommendations({ cart_items: cart });

    alert(product.name + " added to cart!");
}

function buyNowRec(id) {
    var q = parseInt(document.getElementById("qval-rec-" + id).innerText);
    var product = data.find(p => p.product_id === id);

    var directItem = [{ product_id: product.product_id, name: product.name, price: product.price, qty: q }];
    localStorage.setItem('checkoutItems', JSON.stringify(directItem));
    window.location.href = '/checkout';
}

document.addEventListener('DOMContentLoaded', () => {
    // Fetch products from the real API
    fetch('/products')
        .then(res => res.json())
        .then(products => {
            data = products;
            render(data);
        })
        .catch(() => {
            document.getElementById('itemGrid').innerHTML =
                '<p style="text-align:center; margin-top:40px; color:#666;">Failed to load products.</p>';
        });

    var cart = JSON.parse(localStorage.getItem('cart')) || [];
    if (cart.length > 0) {
        fetchRecommendations({ cart_items: cart });
    }

    const checkoutBtn = document.querySelector('.checkout-trigger');
    if (checkoutBtn) checkoutBtn.onclick = handleCheckout;

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('showStatus') === 'true') {
        const modal = document.getElementById('statusModal');
        if (modal) modal.style.display = 'flex';
    }

    // --- CHAT WIDGET LOGIC ---
    const chatToggleBtn = document.getElementById('chatToggleBtn');
    const chatWindow = document.getElementById('chatWindow');
    const chatCloseBtn = document.getElementById('chatCloseBtn');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatInput = document.getElementById('chatInput');
    const chatHistory = document.getElementById('chatHistory');

    if (chatToggleBtn && chatWindow) {
        chatToggleBtn.addEventListener('click', () => {
            chatWindow.style.display = 'flex';
            chatToggleBtn.style.display = 'none';
        });

        chatCloseBtn.addEventListener('click', () => {
            chatWindow.style.display = 'none';
            chatToggleBtn.style.display = 'flex';
        });

        const sendMessage = async () => {
            const message = chatInput.value.trim();
            if (!message) return;

            // 1. Lock the UI so they can't spam messages while waiting
            chatInput.disabled = true;
            chatSendBtn.disabled = true;

            // Append user message
            const userMsgDiv = document.createElement('div');
            userMsgDiv.className = 'chat-msg user';
            userMsgDiv.innerText = message;
            chatHistory.appendChild(userMsgDiv);
            
            chatInput.value = '';
            chatHistory.scrollTop = chatHistory.scrollHeight;

            // Append typing indicator
            const typingDiv = document.createElement('div');
            typingDiv.className = 'chat-msg bot typing';
            typingDiv.innerText = 'Typing...';
            chatHistory.appendChild(typingDiv);
            chatHistory.scrollTop = chatHistory.scrollHeight;

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: message })
                });

                const data = await response.json();
                
                // Remove typing indicator
                if(chatHistory.contains(typingDiv)) {
                    chatHistory.removeChild(typingDiv);
                }

                // Append bot response
                const botMsgDiv = document.createElement('div');
                botMsgDiv.className = 'chat-msg bot';
                botMsgDiv.innerText = response.ok && data.response ? data.response : 'Sorry, I am having trouble connecting right now.';
                chatHistory.appendChild(botMsgDiv);
                
            } catch (error) {
                if(chatHistory.contains(typingDiv)) {
                    chatHistory.removeChild(typingDiv);
                }
                const errorMsgDiv = document.createElement('div');
                errorMsgDiv.className = 'chat-msg bot';
                errorMsgDiv.innerText = 'Sorry, there was a network error.';
                chatHistory.appendChild(errorMsgDiv);
            } finally {
                // 2. Unlock the UI after the API finishes (success or fail)
                chatInput.disabled = false;
                chatSendBtn.disabled = false;
                chatInput.focus(); // puts the cursor back in the box
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }
        };

        chatSendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }
});