// --- ELEMENT SELECTION ---
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeBtn");
const overlay = document.getElementById("overlay");

const addProductBtn = document.getElementById("addProductBtn");
const addProductModal = document.getElementById("addProductModal");
const closeModal = document.getElementById("closeModal");
const productForm = document.getElementById("productForm");

const imageInput = document.getElementById("productImage");
const preview = document.getElementById("imagePreview");

const searchInput = document.getElementById("inventorySearch");
const inventoryCards = document.querySelectorAll(".inventory-card");

// --- SIDEBAR LOGIC ---
if (menuBtn) {
    menuBtn.onclick = () => {
        sidebar.classList.add("open");
        overlay.classList.add("show");
    }
}

if (closeBtn) {
    closeBtn.onclick = () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("show");
    }
}

// --- MODAL LOGIC (OPEN ADD) ---
if (addProductBtn) {
    addProductBtn.onclick = () => {
        document.getElementById("modalTitle").innerText = "Add Product";
        productForm.action = "/admin/products/add"; // Set to Add route
        productForm.reset();
        if (preview) preview.innerHTML = "<span>Upload Image</span>";
        
        addProductModal.classList.add("show");
        overlay.classList.add("show");
    }
}

// --- MODAL LOGIC (OPEN EDIT) ---
window.openEditModal = function(id, name, price, category, desc, stock) {
    document.getElementById("modalTitle").innerText = "Edit Product";
    productForm.action = `/admin/products/edit/${id}`; // Set to Edit route
    
    // Fill form fields
    document.getElementById("formName").value = name;
    document.getElementById("formPrice").value = price;
    document.getElementById("formCategory").value = category;
    document.getElementById("formDescription").value = desc;
    document.getElementById("formStock").value = stock;

    if (preview) preview.innerHTML = "<span>Keep Existing Image</span>";

    addProductModal.classList.add("show");
    overlay.classList.add("show");
}

// --- CLOSE LOGIC ---
if (closeModal) {
    closeModal.onclick = () => {
        addProductModal.classList.remove("show");
        overlay.classList.remove("show");
    }
}

overlay.onclick = () => {
    if (sidebar) sidebar.classList.remove("open");
    if (addProductModal) addProductModal.classList.remove("show");
    overlay.classList.remove("show");
}

// --- IMAGE PREVIEW ---
if (imageInput && preview) {
    imageInput.addEventListener("change", function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`;
            }
            reader.readAsDataURL(file);
        }
    });
}

// --- SEARCH FILTER ---
if (searchInput) {
    searchInput.addEventListener("input", function() {
        const query = this.value.toLowerCase();
        inventoryCards.forEach(card => {
            const name = card.getAttribute("data-name");
            card.style.display = name.includes(query) ? "block" : "none";
        });
    });
}
// --- AUDIT SEARCH FILTER ---
const auditSearch = document.getElementById("auditSearch");
const auditCards = document.querySelectorAll(".audit-card");

if (auditSearch) {
    auditSearch.addEventListener("input", function() {
        const query = this.value.toLowerCase();
        auditCards.forEach(card => {
            const text = card.innerText.toLowerCase();
            card.style.display = text.includes(query) ? "block" : "none";
        });
    });
}

// --- AI INVENTORY INSIGHTS (WITH CACHING) ---
document.addEventListener("DOMContentLoaded", async () => {
    const alertBanner = document.getElementById("ai-inventory-alert");
    const alertBody = alertBanner ? alertBanner.querySelector(".ai-alert-body") : null;
    
    if (!alertBanner || !alertBody) return;

    // 1. Check Session Storage First to save API Quota
    const cachedInsights = sessionStorage.getItem("ai_inventory_insights");
    if (cachedInsights) {
        alertBody.textContent = cachedInsights;
        alertBanner.style.display = "block";
        return; // Exit early, no API call needed!
    }

    // 2. Fetch from API if nothing is cached
    try {
        const response = await fetch("/api/admin/inventory-insights");
        if (!response.ok) throw new Error("Failed to fetch");
        
        const data = await response.json();
        const warningText = data.insights || data.message || (typeof data === "string" ? data : JSON.stringify(data));

        if (warningText) {
            alertBody.textContent = warningText;
            alertBanner.style.display = "block";
            
            // 3. Save the result to Session Storage for next time
            sessionStorage.setItem("ai_inventory_insights", warningText);
        }
    } catch (error) {
        // Catch error silently, leaving the banner hidden (display: none)
    }
});

// --- AI INVENTORY FORECAST ---
document.addEventListener("DOMContentLoaded", () => {
    const forecastBtn = document.getElementById("generate-forecast-btn");
    const forecastResult = document.getElementById("forecast-result");
    const forecastCacheKey = "cached_forecast";

    function renderForecastItems(container, items) {
        container.textContent = "";

        if (!Array.isArray(items) || items.length === 0) {
            container.textContent = "No forecast data available at the moment.";
            return;
        }

        const list = document.createElement("div");

        items.forEach((item, index) => {
            const card = document.createElement("div");
            card.style.padding = "10px 0";
            card.style.borderBottom = "1px solid #eee";

            const title = document.createElement("div");
            title.style.fontWeight = "600";
            title.textContent = `${index + 1}. ${item.name || "Unknown Product"}`;

            const demand = document.createElement("div");
            demand.textContent = `Predicted demand: ${item.predicted_demand || "Unknown"}`;

            const reasoning = document.createElement("div");
            reasoning.textContent = `Reasoning: ${item.reasoning || "No reasoning provided."}`;

            const reorder = document.createElement("div");
            reorder.textContent = `Suggested reorder qty: ${Number.isInteger(item.suggested_reorder_qty) ? item.suggested_reorder_qty : 0}`;

            card.appendChild(title);
            card.appendChild(demand);
            card.appendChild(reasoning);
            card.appendChild(reorder);
            list.appendChild(card);
        });

        container.appendChild(list);
    }

    if (forecastBtn && forecastResult && forecastBtn.dataset.listenerBound !== "true") {
        forecastBtn.dataset.listenerBound = "true";
        forecastBtn.addEventListener("click", async () => {
            const originalBtnText = forecastBtn.innerText;
            forecastBtn.disabled = true;
            forecastBtn.innerText = "Loading...";
            forecastResult.innerText = "Analyzing inventory and sales velocity...";
            
            try {
                const cachedForecastRaw = sessionStorage.getItem(forecastCacheKey);
                if (cachedForecastRaw) {
                    try {
                        const cachedItems = JSON.parse(cachedForecastRaw);
                        renderForecastItems(forecastResult, cachedItems);
                        return;
                    } catch (parseError) {
                        sessionStorage.removeItem(forecastCacheKey);
                    }
                }

                const response = await fetch("/api/admin/inventory-forecast");
                if (!response.ok) throw new Error("Forecast failed");
                
                const data = await response.json();
                if (data.forecast && Array.isArray(data.forecast.forecasted_items)) {
                    renderForecastItems(forecastResult, data.forecast.forecasted_items);
                    sessionStorage.setItem(forecastCacheKey, JSON.stringify(data.forecast.forecasted_items));
                } else if (data.error) {
                    forecastResult.innerText = "Forecast unavailable at the moment.";
                } else {
                    forecastResult.innerText = "No forecast data available at the moment.";
                }
            } catch (error) {
                console.error(error);
                forecastResult.innerText = "Forecast unavailable at the moment.";
            } finally {
                forecastBtn.disabled = false;
                forecastBtn.innerText = originalBtnText;
            }
        });
    }
});