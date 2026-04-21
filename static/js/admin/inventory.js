// Store references that will be populated in DOMContentLoaded
let menuBtn, sidebar, closeBtn, overlay;
let addProductBtn, addProductModal, closeModal, productForm;
let imageInput, preview, imageControls;
let deleteImageBtn;
let removeImageFlag;
let newCategoryWrap, newCategoryInput, saveNewCategoryBtn;
let searchInput, categoryFilter, inventoryCards;
let deleteConfirmModal, deleteResultModal;
let deleteConfirmBtn, deleteCancelBtn, deleteConfirmClose, deleteResultClose, deleteResultOkBtn;
let deleteConfirmMessage, deleteResultMessage, deleteResultTitle;

let pendingDeleteForm = null;
let pendingDeleteCard = null;
let pendingDeleteName = "";

let currentImageData = null; // Store current image for preview
let isEditMode = false;

// --- AUTO-CROP IMAGE TO SQUARE (1:1 aspect ratio) ---
function cropImageToSquare(imageSrc) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement("canvas");
            const size = Math.min(img.width, img.height);
            const x = (img.width - size) / 2;
            const y = (img.height - size) / 2;
            
            canvas.width = size;
            canvas.height = size;
            
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, x, y, size, size, 0, 0, size, size);
            
            resolve(canvas.toDataURL("image/jpeg", 0.9)); // Return as JPEG with 90% quality
        };
        img.onerror = () => resolve(imageSrc); // Fallback to original if error
        img.src = imageSrc;
    });
}

// --- INITIALIZE ON DOM READY ---
document.addEventListener("DOMContentLoaded", function() {
    // Select elements after DOM is ready
    menuBtn = document.getElementById("menuBtn");
    sidebar = document.getElementById("sidebar");
    closeBtn = document.getElementById("closeBtn");
    overlay = document.getElementById("overlay");

    addProductBtn = document.getElementById("addProductBtn");
    addProductModal = document.getElementById("addProductModal");
    closeModal = document.getElementById("closeModal");
    productForm = document.getElementById("productForm");

    imageInput = document.getElementById("productImage");
    preview = document.getElementById("imagePreview");
    imageControls = document.getElementById("imageControls");
    deleteImageBtn = document.getElementById("deleteImageBtn");
    removeImageFlag = document.getElementById("removeImageFlag");
    newCategoryWrap = document.getElementById("newCategoryWrap");
    newCategoryInput = document.getElementById("newCategoryInput");
    saveNewCategoryBtn = document.getElementById("saveNewCategoryBtn");

    searchInput = document.getElementById("inventorySearch");
    categoryFilter = document.getElementById("categoryFilter");
    inventoryCards = document.querySelectorAll(".inventory-card");

    deleteConfirmModal = document.getElementById("deleteConfirmModal");
    deleteResultModal = document.getElementById("deleteResultModal");
    deleteConfirmBtn = document.getElementById("deleteConfirmBtn");
    deleteCancelBtn = document.getElementById("deleteCancelBtn");
    deleteConfirmClose = document.getElementById("deleteConfirmClose");
    deleteResultClose = document.getElementById("deleteResultClose");
    deleteResultOkBtn = document.getElementById("deleteResultOkBtn");
    deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
    deleteResultMessage = document.getElementById("deleteResultMessage");
    deleteResultTitle = document.getElementById("deleteResultTitle");

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

    // --- OVERLAY CLICK LOGIC (only close when modal/sidebar is open) ---
    overlay.onclick = (event) => {
        // Only close if overlay is actually showing (not just opacity:0)
        if (overlay.classList.contains("show")) {
            if (sidebar) sidebar.classList.remove("open");
            if (addProductModal) addProductModal.classList.remove("show");
            overlay.classList.remove("show");
        }
    }

    // --- MODAL LOGIC (OPEN ADD) ---
    const addBtn = addProductBtn || document.querySelector(".add-btn");
    if (addBtn) {
        addBtn.onclick = () => {
            document.getElementById("modalTitle").innerText = "Add Product";
            productForm.action = "/admin/products/add";
            productForm.reset();
            if (preview) {
                preview.innerHTML = '<span class="image-placeholder">Click to upload image</span><button type="button" class="image-remove-btn" id="deleteImageBtn" aria-label="Remove image">✕</button>';
            }
            if (deleteImageBtn) deleteImageBtn.style.display = "none";
            if (removeImageFlag) removeImageFlag.value = "0";
            const formCategory = document.getElementById("formCategory");
            if (formCategory && formCategory.options.length > 0) {
                formCategory.value = formCategory.options[0].value;
            }
            if (newCategoryWrap) newCategoryWrap.style.display = "none";
            if (newCategoryInput) newCategoryInput.value = "";
            currentImageData = null;
            isEditMode = false;
            addProductModal.classList.add("show");
            overlay.classList.add("show");
        }
    }

    // --- CLOSE MODAL LOGIC ---
    if (closeModal) {
        closeModal.onclick = () => {
            addProductModal.classList.remove("show");
            overlay.classList.remove("show");
        }
    }

    // --- IMAGE PREVIEW WITH CONTROLS ---
    if (imageInput && preview) {
        const openFilePicker = () => imageInput.click();

        preview.addEventListener("click", openFilePicker);

        if (deleteImageBtn) {
            deleteImageBtn.addEventListener("click", function(event) {
                event.stopPropagation();
                deleteImage();
            });
        }

        imageInput.addEventListener("change", function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async function(e) {
                    // Auto-crop image to square before displaying
                    const croppedSrc = await cropImageToSquare(e.target.result);
                    preview.innerHTML = `<img src="${croppedSrc}" alt="Selected product image" style="width:100%; height:100%; object-fit:cover;"><button type="button" class="image-remove-btn" id="deleteImageBtn" aria-label="Remove image">✕</button>`;
                    currentImageData = croppedSrc;
                    if (removeImageFlag) removeImageFlag.value = "0";
                    const newDeleteBtn = document.getElementById("deleteImageBtn");
                    if (newDeleteBtn) {
                        newDeleteBtn.style.display = "flex";
                        newDeleteBtn.onclick = function(event) {
                            event.stopPropagation();
                            deleteImage();
                        };
                    }
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // --- FORM SUBMISSION: Send cropped image if available ---
    if (productForm) {
        productForm.addEventListener("submit", async function(e) {
            const formCategory = document.getElementById("formCategory");
            if (formCategory && formCategory.value === "__add_new__") {
                e.preventDefault();
                alert("Please save the new category first.");
                return;
            }

            // If we have a cropped image, convert it to a Blob and update the file input
            if (currentImageData && currentImageData !== imageInput.value) {
                try {
                    const response = await fetch(currentImageData);
                    const blob = await response.blob();
                    
                    // Create a new File object from the Blob
                    const file = new File([blob], "product-image-cropped.jpg", { type: "image/jpeg" });
                    
                    // Create a DataTransfer to set the file input
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    imageInput.files = dataTransfer.files;
                } catch (error) {
                    console.error("Error converting cropped image:", error);
                    // Continue with original file if conversion fails
                }
            }
        });
    }

    // --- SEARCH & CATEGORY FILTER ---
    function applyFilters() {
        const searchQuery = searchInput ? searchInput.value.toLowerCase() : "";
        const categoryQuery = categoryFilter ? categoryFilter.value.toLowerCase() : "";

        inventoryCards.forEach(card => {
            const name = card.getAttribute("data-pname") || "";
            const category = card.getAttribute("data-pcat") || "";

            const matchesSearch = name.includes(searchQuery);
            const matchesCategory = !categoryQuery || category.includes(categoryQuery);

            card.style.display = (matchesSearch && matchesCategory) ? "block" : "none";
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", applyFilters);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener("change", applyFilters);
    }

    const formCategory = document.getElementById("formCategory");
    if (formCategory) {
        formCategory.addEventListener("change", function() {
            if (this.value === "__add_new__") {
                if (newCategoryWrap) newCategoryWrap.style.display = "block";
                if (newCategoryInput) newCategoryInput.focus();
            } else {
                if (newCategoryWrap) newCategoryWrap.style.display = "none";
                if (newCategoryInput) newCategoryInput.value = "";
            }
        });
    }

    if (saveNewCategoryBtn) {
        saveNewCategoryBtn.addEventListener("click", async function() {
            const rawName = newCategoryInput ? newCategoryInput.value : "";
            const name = String(rawName || "").trim();
            if (!name) {
                alert("Category name cannot be empty.");
                return;
            }

            saveNewCategoryBtn.disabled = true;
            try {
                const response = await fetch("/admin/categories/add", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({ name })
                });
                const payload = await response.json();

                if (!response.ok || !payload || !payload.success || !payload.category) {
                    alert((payload && payload.message) ? payload.message : "Unable to add category.");
                    return;
                }

                const catId = String(payload.category.id);
                const catName = String(payload.category.name);

                if (formCategory) {
                    const existingOption = Array.from(formCategory.options).find(option => option.value === catId);
                    if (!existingOption) {
                        const newOption = document.createElement("option");
                        newOption.value = catId;
                        newOption.textContent = catName;
                        const addNewOption = formCategory.querySelector('option[value="__add_new__"]');
                        if (addNewOption) {
                            formCategory.insertBefore(newOption, addNewOption);
                        } else {
                            formCategory.appendChild(newOption);
                        }
                    }

                    formCategory.value = catId;
                }

                if (newCategoryWrap) newCategoryWrap.style.display = "none";
                if (newCategoryInput) newCategoryInput.value = "";
            } catch (error) {
                alert("Unable to add category right now.");
            } finally {
                saveNewCategoryBtn.disabled = false;
            }
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

    initializeDeleteFeature();

    // Initialize AI functionality
    initializeAIFeatures();
});

function showDeleteConfirmModal() {
    if (!deleteConfirmModal) return;
    deleteConfirmModal.classList.add("show");
}

function hideDeleteConfirmModal() {
    if (!deleteConfirmModal) return;
    deleteConfirmModal.classList.remove("show");
}

function showDeleteResultModal(message, isSuccess) {
    if (!deleteResultModal || !deleteResultMessage || !deleteResultTitle) return;
    deleteResultMessage.textContent = message;
    deleteResultTitle.textContent = isSuccess ? "Success" : "Delete Failed";
    deleteResultModal.classList.add("show");
}

function hideDeleteResultModal() {
    if (!deleteResultModal) return;
    deleteResultModal.classList.remove("show");
}

async function executeConfirmedDelete() {
    if (!pendingDeleteForm) {
        hideDeleteConfirmModal();
        return;
    }

    if (deleteConfirmBtn) deleteConfirmBtn.disabled = true;

    try {
        const response = await fetch(pendingDeleteForm.action, {
            method: "POST",
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json"
            }
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch (parseError) {
            payload = null;
        }

        hideDeleteConfirmModal();

        if (response.ok && payload && payload.success) {
            if (pendingDeleteCard) {
                pendingDeleteCard.remove();
                inventoryCards = document.querySelectorAll(".inventory-card");
            }
            showDeleteResultModal(payload.message || "Item successfully deleted.", true);
        } else {
            const message = payload && payload.message
                ? payload.message
                : "Unable to delete this item. Please try again.";
            showDeleteResultModal(message, false);
        }
    } catch (error) {
        hideDeleteConfirmModal();
        showDeleteResultModal("Unable to delete this item right now. Please try again.", false);
    } finally {
        pendingDeleteForm = null;
        pendingDeleteCard = null;
        pendingDeleteName = "";
        if (deleteConfirmBtn) deleteConfirmBtn.disabled = false;
    }
}

function initializeDeleteFeature() {
    const deleteForms = document.querySelectorAll('#inventoryContainer form[action*="/admin/products/delete/"]');

    deleteForms.forEach(form => {
        form.addEventListener("submit", function(event) {
            event.preventDefault();

            const card = form.closest(".inventory-card");
            const productName = card ? (card.getAttribute("data-pname") || "this item") : "this item";

            pendingDeleteForm = form;
            pendingDeleteCard = card;
            pendingDeleteName = productName;

            if (deleteConfirmMessage) {
                deleteConfirmMessage.textContent = `Are you sure you want to delete ${productName}?`;
            }

            showDeleteConfirmModal();
        });
    });

    if (deleteCancelBtn) {
        deleteCancelBtn.addEventListener("click", function() {
            pendingDeleteForm = null;
            pendingDeleteCard = null;
            pendingDeleteName = "";
            hideDeleteConfirmModal();
        });
    }

    if (deleteConfirmClose) {
        deleteConfirmClose.addEventListener("click", function() {
            pendingDeleteForm = null;
            pendingDeleteCard = null;
            pendingDeleteName = "";
            hideDeleteConfirmModal();
        });
    }

    if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener("click", function() {
            executeConfirmedDelete();
        });
    }

    if (deleteResultClose) {
        deleteResultClose.addEventListener("click", hideDeleteResultModal);
    }

    if (deleteResultOkBtn) {
        deleteResultOkBtn.addEventListener("click", hideDeleteResultModal);
    }
}

// --- MODAL LOGIC (OPEN EDIT) ---
window.openEditModal = function(id, name, price, category, categoryId, unit, variant, desc, stock, imageFilename) {
    document.getElementById("modalTitle").innerText = "Edit Product";
    productForm.action = `/admin/products/edit/${id}`;
    
    // Fill form fields
    document.getElementById("formName").value = name;
    document.getElementById("formPrice").value = price;
    const categorySelect = document.getElementById("formCategory");
    if (categorySelect) {
        if (categoryId && Array.from(categorySelect.options).some(option => option.value === String(categoryId))) {
            categorySelect.value = String(categoryId);
        } else {
            const fallbackOption = Array.from(categorySelect.options).find(option => option.textContent.trim().toLowerCase() === String(category || "").trim().toLowerCase());
            categorySelect.value = fallbackOption ? fallbackOption.value : (categorySelect.options[0] ? categorySelect.options[0].value : "");
        }
    }
    document.getElementById("formUnit").value = unit || "pcs";
    document.getElementById("formVariant").value = variant || 1;
    document.getElementById("formDescription").value = desc;
    document.getElementById("formStock").value = stock;

    // Reset image preview
    if (imageFilename) {
        preview.innerHTML = `<img src="/product-image/${imageFilename}" style="width:100%; height:100%; object-fit:cover;" alt="Product"><button type="button" class="image-remove-btn" id="deleteImageBtn" aria-label="Remove image">✕</button>`;
        const newDeleteBtn = document.getElementById("deleteImageBtn");
        if (newDeleteBtn) {
            newDeleteBtn.style.display = "flex";
            newDeleteBtn.onclick = function(event) {
                event.stopPropagation();
                deleteImage();
            };
        }
    } else {
        preview.innerHTML = '<span class="image-placeholder">Click to upload image</span><button type="button" class="image-remove-btn" id="deleteImageBtn" aria-label="Remove image" style="display:none;">✕</button>';
    }

    if (removeImageFlag) removeImageFlag.value = "0";
    if (newCategoryWrap) newCategoryWrap.style.display = "none";
    if (newCategoryInput) newCategoryInput.value = "";
    currentImageData = null;
    isEditMode = true;
    addProductModal.classList.add("show");
    overlay.classList.add("show");
}

// --- MODAL LOGIC (OPEN EDIT FROM CARD) ---
window.openEditModalFromCard = function(button) {
    const card = button.closest(".inventory-card");
    const id = card.getAttribute("data-id");
    const name = card.getAttribute("data-pname");
    const price = card.getAttribute("data-price");
    const category = card.getAttribute("data-pcat");
    const categoryId = card.getAttribute("data-pcatid");
    const unit = card.getAttribute("data-punit");
    const variant = card.getAttribute("data-pvariant");
    const desc = card.getAttribute("data-desc");
    const stock = card.getAttribute("data-stock");
    const image = card.getAttribute("data-image");
    
    openEditModal(id, name, price, category, categoryId, unit, variant, desc, stock, image);
}

// --- DELETE IMAGE FUNCTION ---
window.deleteImage = function() {
    if (preview) {
        if (isEditMode) {
            preview.innerHTML = '<span class="image-placeholder">Click to upload image</span><button type="button" class="image-remove-btn" id="deleteImageBtn" aria-label="Remove image" style="display:none;">✕</button>';
        } else {
            preview.innerHTML = '<span class="image-placeholder">Click to upload image</span><button type="button" class="image-remove-btn" id="deleteImageBtn" aria-label="Remove image" style="display:none;">✕</button>';
        }
    }
    if (imageInput) imageInput.value = "";
    if (removeImageFlag) removeImageFlag.value = isEditMode ? "1" : "0";
    currentImageData = null;
}

// --- MINIMIZE AI PANEL ---
window.minimizeAIPanel = function(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.toggle("minimized");
    }
}

// --- AI INVENTORY INSIGHTS + FORECAST (BUTTON-TRIGGERED, JSON RENDERED) ---
let insightsInFlight = false;
let forecastInFlight = false;
let cachedInsights = null;
let cachedForecast = null;

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

    // Show control buttons when content is generated
    const aiCard = container.closest(".ai-card");
    if (aiCard) {
        const downloadBtn = aiCard.querySelector(".ai-download-icon-btn");
        const minimizeBtn = aiCard.querySelector(".ai-minimize-btn");
        if (downloadBtn) downloadBtn.style.display = "flex";
        if (minimizeBtn) minimizeBtn.style.display = "flex";
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

    // Show control buttons when content is generated
    const aiCard = container.closest(".ai-card");
    if (aiCard) {
        const downloadBtn = aiCard.querySelector(".ai-download-icon-btn");
        const minimizeBtn = aiCard.querySelector(".ai-minimize-btn");
        if (downloadBtn) downloadBtn.style.display = "flex";
        if (minimizeBtn) minimizeBtn.style.display = "flex";
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

// --- INITIALIZE AI FEATURES ---
function initializeAIFeatures() {
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
                    cachedInsights = cachedPayload;
                    renderInsightsPayload(insightsResult, cachedPayload);
                    return;
                }

                const response = await fetch("/api/admin/inventory-insights");
                if (!response.ok) throw new Error("Insights request failed");

                const data = await response.json();
                const payload = data && data.insights ? data.insights : null;

                cachedInsights = payload;
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
                    cachedForecast = cachedPayload;
                    renderForecastPayload(forecastResult, cachedPayload);
                    return;
                }

                const response = await fetch("/api/admin/inventory-forecast");
                if (!response.ok) throw new Error("Forecast request failed");

                const data = await response.json();
                const payload = data && data.report ? data.report : null;

                cachedForecast = payload;
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
}

// --- DOWNLOAD AI RESULT ---
window.downloadAIResult = function(type) {
    const jsPdfApi = window.jspdf;
    if (!jsPdfApi || !jsPdfApi.jsPDF) {
        alert("PDF library is not available right now. Please refresh and try again.");
        return;
    }

    let data = null;
    let filename = "";

    if (type === "insights" && cachedInsights) {
        data = cachedInsights;
        filename = "AI_Inventory_Insights.pdf";
    } else if (type === "forecast" && cachedForecast) {
        data = cachedForecast;
        filename = "AI_Forecast_Recommendations.pdf";
    }

    if (!data) {
        alert("No data available to download. Please generate the " + type + " first.");
        return;
    }

    const { jsPDF } = jsPdfApi;
    const isForecast = type === "forecast";
    const doc = new jsPDF({
        orientation: isForecast ? "landscape" : "portrait",
        unit: "pt",
        format: "a4"
    });

    const marginX = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - (marginX * 2);
    let y = 48;

    const addWrappedText = (text, fontSize = 11, lineGap = 16, style = "normal") => {
        if (!text) return;
        doc.setFont("helvetica", style);
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(String(text), contentWidth);
        doc.text(lines, marginX, y);
        y += (lines.length * lineGap);
    };

    if (type === "insights") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("AI Inventory Insights", marginX, y);
        y += 28;

        if (data.headline) {
            addWrappedText(String(data.headline), 13, 17, "bold");
            y += 4;
        }

        if (data.summary) {
            addWrappedText(String(data.summary), 11, 16, "normal");
            y += 8;
        }

        if (Array.isArray(data.alerts) && data.alerts.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("Alerts", marginX, y);
            y += 18;

            data.alerts.forEach((alert, index) => {
                const severity = (alert && alert.severity ? String(alert.severity) : "info").toUpperCase();
                const text = alert && alert.text ? String(alert.text) : "";
                addWrappedText(`${index + 1}. [${severity}] ${text}`, 11, 16, "normal");
            });
        }
    } else if (type === "forecast") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("AI Forecast & Recommendations", marginX, y);
        y += 28;

        if (data.headline) {
            addWrappedText(String(data.headline), 13, 17, "bold");
            y += 4;
        }

        if (data.summary) {
            addWrappedText(String(data.summary), 11, 16, "normal");
            y += 8;
        }

        if (data.critical_alerts && data.critical_alerts.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("Critical Alerts", marginX, y);
            y += 18;

            data.critical_alerts.forEach((alert, index) => {
                addWrappedText(`${index + 1}. ${String(alert)}`, 11, 16, "normal");
            });
            y += 6;
        }

        if (data.table && data.table.rows && data.table.rows.length > 0) {
            const columns = data.table.columns || ["Product", "Current Stock", "Sold (30d)", "Projected Demand (14d)", "Recommended Reorder", "Urgency", "Notes"];
            const bodyRows = data.table.rows.map(row => [
                row && row.product !== undefined ? String(row.product) : "",
                row && row.current_stock !== undefined ? String(row.current_stock) : "",
                row && row.sold_last_30_days !== undefined ? String(row.sold_last_30_days) : "",
                row && row.projected_14_day_demand !== undefined ? String(row.projected_14_day_demand) : "",
                row && row.recommended_reorder !== undefined ? String(row.recommended_reorder) : "",
                row && row.urgency !== undefined ? String(row.urgency) : "",
                row && row.note !== undefined ? String(row.note) : ""
            ]);

            doc.autoTable({
                startY: y,
                head: [columns],
                body: bodyRows,
                theme: "grid",
                margin: { left: marginX, right: marginX },
                styles: {
                    font: "helvetica",
                    fontSize: 9,
                    cellPadding: 5,
                    overflow: "linebreak",
                    valign: "top"
                },
                headStyles: {
                    fillColor: [247, 242, 234],
                    textColor: [26, 50, 62],
                    fontStyle: "bold"
                },
                didParseCell: (hookData) => {
                    if (hookData.section === "body") {
                        const urgencyValue = String(hookData.row.raw[5] || "").toLowerCase();
                        if (urgencyValue === "high") {
                            hookData.cell.styles.textColor = [166, 23, 28];
                            hookData.cell.styles.fontStyle = "bold";
                        } else if (urgencyValue === "medium") {
                            hookData.cell.styles.textColor = [126, 67, 0];
                            hookData.cell.styles.fontStyle = "bold";
                        }
                    }
                },
                columnStyles: {
                    0: { cellWidth: 95 },
                    1: { cellWidth: 55 },
                    2: { cellWidth: 60 },
                    3: { cellWidth: 85 },
                    4: { cellWidth: 95 },
                    5: { cellWidth: 55 },
                    6: { cellWidth: "auto" }
                }
            });

            y = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : y) + 16;
        }

        if (data.recommendations && data.recommendations.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("Recommendations", marginX, y);
            y += 18;

            data.recommendations.forEach((rec, i) => {
                addWrappedText(`${i + 1}. ${String(rec)}`, 11, 16, "normal");
            });
        }
    }

    doc.save(filename);
}