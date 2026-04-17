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

// --- AI INVENTORY INSIGHTS + FORECAST (BUTTON-TRIGGERED, JSON RENDERED) ---
let insightsInFlight = false;
let forecastInFlight = false;

function createTextElement(tagName, className, textValue) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = textValue;
    return element;
}

function renderInsightsPayload(container, payload) {
    container.innerHTML = "";

    if (!payload || typeof payload !== "object") {
        container.textContent = "Insights unavailable at the moment.";
        return;
    }

    if (payload.headline) {
        container.appendChild(createTextElement("h4", "ai-block-title", payload.headline));
    }

    if (payload.summary) {
        container.appendChild(createTextElement("p", "ai-block-summary", payload.summary));
    }

    if (Array.isArray(payload.alerts) && payload.alerts.length > 0) {
        const list = document.createElement("ul");
        list.className = "ai-list";

        payload.alerts.forEach(item => {
            const text = item && item.text ? String(item.text).trim() : "";
            if (!text) return;

            const severity = item && item.severity ? String(item.severity).toLowerCase() : "info";
            const normalizedSeverity = ["critical", "warning", "watch", "info"].includes(severity) ? severity : "info";

            const listItem = createTextElement("li", `ai-list-item severity-${normalizedSeverity}`, text);
            list.appendChild(listItem);
        });

        if (list.children.length > 0) {
            container.appendChild(list);
        }
    }
}

function renderForecastPayload(container, payload) {
    container.innerHTML = "";

    if (!payload || typeof payload !== "object") {
        container.textContent = "Forecast unavailable at the moment.";
        return;
    }

    if (payload.headline) {
        container.appendChild(createTextElement("h4", "ai-block-title", payload.headline));
    }

    if (payload.summary) {
        container.appendChild(createTextElement("p", "ai-block-summary", payload.summary));
    }

    if (Array.isArray(payload.critical_alerts) && payload.critical_alerts.length > 0) {
        const criticalLabel = createTextElement("p", "ai-section-label", "Critical Alerts");
        container.appendChild(criticalLabel);

        const criticalList = document.createElement("ul");
        criticalList.className = "ai-list";

        payload.critical_alerts.forEach(textValue => {
            const clean = String(textValue || "").trim();
            if (!clean) return;
            criticalList.appendChild(createTextElement("li", "ai-list-item severity-critical", clean));
        });

        if (criticalList.children.length > 0) {
            container.appendChild(criticalList);
        }
    }

    if (payload.table && Array.isArray(payload.table.rows) && payload.table.rows.length > 0) {
        const tableWrap = document.createElement("div");
        tableWrap.className = "ai-table-wrap";

        const table = document.createElement("table");
        table.className = "ai-table";

        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        const columns = Array.isArray(payload.table.columns) && payload.table.columns.length > 0
            ? payload.table.columns
            : ["Product", "Current Stock", "Sold (30d)", "Projected Demand (14d)", "Recommended Reorder", "Urgency", "Notes"];

        columns.forEach(columnTitle => {
            const th = document.createElement("th");
            th.textContent = String(columnTitle);
            headRow.appendChild(th);
        });

        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        payload.table.rows.forEach(row => {
            const tr = document.createElement("tr");

            const urgency = row && row.urgency ? String(row.urgency).toLowerCase() : "low";
            if (urgency === "high") tr.classList.add("urgency-high");
            if (urgency === "medium") tr.classList.add("urgency-medium");

            const values = [
                row.product,
                row.current_stock,
                row.sold_last_30_days,
                row.projected_14_day_demand,
                row.recommended_reorder,
                row.urgency,
                row.note
            ];

            values.forEach(value => {
                const td = document.createElement("td");
                td.textContent = value === undefined || value === null ? "" : String(value);
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        tableWrap.appendChild(table);
        container.appendChild(tableWrap);
    }

    if (Array.isArray(payload.recommendations) && payload.recommendations.length > 0) {
        const recommendationLabel = createTextElement("p", "ai-section-label", "Action Recommendations");
        container.appendChild(recommendationLabel);

        const recommendationList = document.createElement("ul");
        recommendationList.className = "ai-list";
        payload.recommendations.forEach(textValue => {
            const clean = String(textValue || "").trim();
            if (!clean) return;
            recommendationList.appendChild(createTextElement("li", "ai-list-item", clean));
        });

        if (recommendationList.children.length > 0) {
            container.appendChild(recommendationList);
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const insightsBtn = document.getElementById("generate-insights-btn");
    const insightsResult = document.getElementById("insights-result");
    const forecastBtn = document.getElementById("generate-forecast-btn");
    const forecastResult = document.getElementById("forecast-result");

    const insightsCacheKey = "cached_inventory_insights_json_v1";
    const forecastCacheKey = "cached_inventory_forecast_json_v2";

    if (insightsBtn && insightsResult && insightsBtn.dataset.listenerBound !== "true") {
        insightsBtn.dataset.listenerBound = "true";
        insightsBtn.addEventListener("click", async () => {
            if (insightsInFlight) return;

            const originalText = insightsBtn.textContent;
            insightsInFlight = true;
            insightsBtn.disabled = true;
            insightsBtn.textContent = "Loading...";
            insightsResult.textContent = "Analyzing inventory health...";

            try {
                const cachedRaw = sessionStorage.getItem(insightsCacheKey);
                if (cachedRaw) {
                    const cachedPayload = JSON.parse(cachedRaw);
                    renderInsightsPayload(insightsResult, cachedPayload);
                    return;
                }

                const response = await fetch("/api/admin/inventory-insights");
                if (!response.ok) throw new Error("Insights request failed");

                const data = await response.json();
                const payload = data && data.insights ? data.insights : null;

                renderInsightsPayload(insightsResult, payload);
                if (payload) {
                    sessionStorage.setItem(insightsCacheKey, JSON.stringify(payload));
                }
            } catch (error) {
                console.error(error);
                insightsResult.textContent = "Insights unavailable at the moment.";
            } finally {
                insightsInFlight = false;
                insightsBtn.disabled = false;
                insightsBtn.textContent = originalText;
            }
        });
    }

    if (forecastBtn && forecastResult && forecastBtn.dataset.listenerBound !== "true") {
        forecastBtn.dataset.listenerBound = "true";
        forecastBtn.addEventListener("click", async () => {
            if (forecastInFlight) return;

            const originalText = forecastBtn.textContent;
            forecastInFlight = true;
            forecastBtn.disabled = true;
            forecastBtn.textContent = "Loading...";
            forecastResult.textContent = "Analyzing inventory and sales velocity...";

            try {
                const cachedRaw = sessionStorage.getItem(forecastCacheKey);
                if (cachedRaw) {
                    const cachedPayload = JSON.parse(cachedRaw);
                    renderForecastPayload(forecastResult, cachedPayload);
                    return;
                }

                const response = await fetch("/api/admin/inventory-forecast");
                if (!response.ok) throw new Error("Forecast request failed");

                const data = await response.json();
                const payload = data && data.report ? data.report : null;

                renderForecastPayload(forecastResult, payload);
                if (payload) {
                    sessionStorage.setItem(forecastCacheKey, JSON.stringify(payload));
                }
            } catch (error) {
                console.error(error);
                forecastResult.textContent = "Forecast unavailable at the moment.";
            } finally {
                forecastInFlight = false;
                forecastBtn.disabled = false;
                forecastBtn.textContent = originalText;
            }
        });
    }
});