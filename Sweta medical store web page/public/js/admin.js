/* 🏥 SELLER DASHBOARD CONTROLLER & CLIENT */

let adminOrders = [];
let adminProducts = [];
let activeTab = "orders";
let selectedOrderId = null;
let currentPasscode = "";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Check existing authorization
    checkExistingSession();
    
    // 2. Setup passcode submissions
    setupUnlockControls();
    
    // 3. Setup modal cancel / click-away handlers
    setupGlobalModalClosers();
    
    // 4. Setup inventory CRUD control triggers
    setupInventoryCrudControls();
});

/* ==========================================
   1. SECURITY PASSCODE GATE MANAGER
   ========================================== */
function checkExistingSession() {
    const savedCode = sessionStorage.getItem("sweta-admin-passcode");
    if (savedCode === "SWETA2026") {
        currentPasscode = savedCode;
        unlockDashboardSuccess();
    }
}

function setupUnlockControls() {
    const input = document.getElementById("admin-passcode-input");
    const submitBtn = document.getElementById("unlock-submit-btn");
    const lockScreen = document.getElementById("admin-lock-screen");
    const logoutBtn = document.getElementById("lock-dashboard-btn");

    if (submitBtn && input) {
        // Click action
        submitBtn.addEventListener("click", () => verifyUnlockPasscode(input.value));
        // Enter key action
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                verifyUnlockPasscode(input.value);
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            sessionStorage.removeItem("sweta-admin-passcode");
            currentPasscode = "";
            lockScreen.classList.remove("unlocked");
            document.getElementById("dashboard-container").classList.remove("authorized");
            window.showToast("Dashboard locked", "info");
        });
    }
}

function verifyUnlockPasscode(passcode) {
    const errorMsg = document.getElementById("passcode-error");
    
    if (passcode === "SWETA2026") {
        currentPasscode = passcode;
        sessionStorage.setItem("sweta-admin-passcode", passcode);
        errorMsg.style.display = "none";
        
        unlockDashboardSuccess();
        window.showToast("Seller Dashboard unlocked successfully");
    } else {
        errorMsg.style.display = "block";
        errorMsg.style.animation = "pulse 0.4s ease 2";
        window.showToast("Access Denied: Invalid passcode", "error");
    }
}

function unlockDashboardSuccess() {
    document.getElementById("admin-lock-screen").classList.add("unlocked");
    document.getElementById("dashboard-container").classList.add("authorized");
    
    // Fetch dashboard listings
    refreshDashboardData();
}

/* ==========================================
   2. API DATA EXTRACTION & COMPILATION
   ========================================== */
async function refreshDashboardData() {
    try {
        // Fetch products
        const prodRes = await fetch("/api/products");
        if (prodRes.ok) {
            adminProducts = await prodRes.json();
        }

        // Fetch orders (needs passcode verification header)
        const orderRes = await fetch("/api/orders", {
            headers: { "X-Admin-Passcode": currentPasscode }
        });
        if (orderRes.ok) {
            adminOrders = await orderRes.json();
        }

        // Render analytics metrics
        compileAnalyticsMetrics();

        // Render active datasets
        if (activeTab === "orders") {
            renderOrdersTable();
        } else {
            renderInventoryTable();
        }

    } catch (err) {
        console.error("Dashboard refresh error:", err);
        window.showToast("Server connection error during sync", "error");
    }
}

function compileAnalyticsMetrics() {
    const pendingVal = document.getElementById("metric-pending");
    const activeVal = document.getElementById("metric-active");
    const salesVal = document.getElementById("metric-sales");
    const stockVal = document.getElementById("metric-stock");

    if (!pendingVal) return;

    // 1. Pending reviews count
    const pendingCount = adminOrders.filter(o => o.status === "Pending").length;
    pendingVal.textContent = pendingCount;

    // 2. Active orders count (Not completed and not cancelled)
    const activeCount = adminOrders.filter(o => o.status !== "Completed" && o.status !== "Cancelled").length;
    activeVal.textContent = activeCount;

    // 3. Estimated Sales Revenue (Completed billing sum)
    const completedOrders = adminOrders.filter(o => o.status === "Completed");
    const totalSales = completedOrders.reduce((acc, curr) => acc + curr.totalPrice, 0);
    salesVal.textContent = `₹${totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

    // 4. Low stock alert counter (stock level < 10)
    const lowStockCount = adminProducts.filter(p => p.stock < 10).length;
    stockVal.textContent = lowStockCount;
    
    // Low stock color code trigger
    const parentCard = stockVal.closest(".metric-card");
    if (parentCard) {
        if (lowStockCount > 0) {
            parentCard.style.borderColor = "var(--accent-red)";
        } else {
            parentCard.style.borderColor = "var(--border-card)";
        }
    }
}

/* ==========================================
   3. SELLER TAB NAVIGATION
   ========================================== */
window.switchDashboardTab = function(tabName) {
    activeTab = tabName;
    
    // Update active tab buttons
    document.querySelectorAll(".admin-tab-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById(`tab-btn-${tabName}`).classList.add("active");

    // Update active content blocks
    document.querySelectorAll(".admin-tab-content").forEach(content => content.classList.remove("active"));
    document.getElementById(`tab-content-${tabName}`).classList.add("active");

    // Re-render
    if (tabName === "orders") {
        renderOrdersTable();
    } else {
        renderInventoryTable();
    }
};

/* ==========================================
   4. BUYER ORDERS TICKETS VIEW
   ========================================== */
function renderOrdersTable() {
    const tbody = document.getElementById("orders-table-body");
    if (!tbody) return;

    // Fetch active order status filter
    const statusFilter = document.querySelector("#order-status-filters .category-pill.active")?.getAttribute("data-status") || "All";
    
    // Sort chronologically (newest first)
    const sortedOrders = [...adminOrders].reverse();
    const filteredOrders = sortedOrders.filter(o => statusFilter === "All" || o.status === statusFilter);

    if (filteredOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color:var(--text-muted);">
            No order requests registered under the '${statusFilter}' filter category.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filteredOrders.map(order => {
        const itemSummary = order.items.map(item => `${item.name} (${item.quantity})`).join(", ");
        const statusClass = order.status.replace(/ /g, "_");
        
        return `
            <tr id="row-order-${order.id}">
                <td><strong style="color:var(--accent-cyan);">${order.trackerId}</strong></td>
                <td>
                    <div><strong>${order.customerName}</strong></div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${order.phone}</div>
                </td>
                <td><span style="font-size:0.85rem;">${order.date}</span></td>
                <td>
                    <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size:0.85rem; color:var(--text-muted);" title="${itemSummary}">
                        ${itemSummary}
                    </div>
                </td>
                <td><strong>₹${order.totalPrice.toFixed(2)}</strong></td>
                <td>
                    ${order.prescriptionPath ? `
                        <span class="status-pill Approved" style="font-size:0.65rem;">Rx Attached</span>
                    ` : `
                        <span style="font-size:0.75rem; color:var(--text-muted);">None</span>
                    `}
                </td>
                <td><span class="status-pill ${statusClass}">${order.status}</span></td>
                <td>
                    <button class="table-action-btn" onclick="openOrderDetailsModal('${order.id}')" title="Inspect Order & prescription">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// Bind order filter actions
const orderFilters = document.getElementById("order-status-filters");
if (orderFilters) {
    orderFilters.addEventListener("click", (e) => {
        const btn = e.target.closest(".category-pill");
        if (!btn) return;
        orderFilters.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        renderOrdersTable();
    });
}

/* ==========================================
   5. ORDER DISPATCH & PRESCRIPTION WORKFLOW
   ========================================== */
window.openOrderDetailsModal = function(orderId) {
    const order = adminOrders.find(o => o.id === orderId);
    if (!order) return;

    selectedOrderId = orderId;

    document.getElementById("detail-modal-tracker-id").innerHTML = `Order Detail: <span class="gradient-text">${order.trackerId}</span>`;
    document.getElementById("detail-modal-date").textContent = `Submitted on ${order.date}`;
    document.getElementById("detail-patient-name").textContent = order.customerName;
    document.getElementById("detail-patient-phone").textContent = order.phone;
    document.getElementById("detail-patient-address").textContent = order.address;
    document.getElementById("detail-total-price").textContent = `₹${order.totalPrice.toFixed(2)}`;

    // Render items list inside detail modal
    const itemsContainer = document.getElementById("detail-items-list-container");
    itemsContainer.innerHTML = order.items.map(item => `
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.9rem;">
            <span>${item.name} <strong style="color:var(--accent-cyan);">x${item.quantity}</strong></span>
            <span>₹${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join("");

    // Set dropdown current status value
    document.getElementById("detail-status-select").value = order.status;

    // Prescription Attachment Viewer Loader
    const prescriptionBox = document.getElementById("detail-prescription-box");
    if (order.prescriptionPath) {
        prescriptionBox.innerHTML = `
            <img src="${order.prescriptionPath}" id="presc-inspect-img" alt="Prescription Document image" title="Click to view full image in high resolution">
            <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.6); padding:4px; text-align:center; font-size:0.7rem; color:white;">
                Click to inspect document (Zoom HD)
            </div>
        `;
        prescriptionBox.style.cursor = "zoom-in";
        
        // Add zoom popup bind
        const img = document.getElementById("presc-inspect-img");
        img.addEventListener("click", () => {
            const zoomOverlay = document.getElementById("zoom-overlay");
            const zoomImg = document.getElementById("zoom-img");
            zoomImg.src = order.prescriptionPath;
            zoomOverlay.classList.add("active");
        });
    } else {
        prescriptionBox.innerHTML = `<span class="no-prescription-txt">No Prescription Document Uploaded</span>`;
        prescriptionBox.style.cursor = "default";
    }

    document.getElementById("order-detail-modal").classList.add("active");
};

// Dispatch workflow update status
const saveStatusBtn = document.getElementById("detail-save-status-btn");
if (saveStatusBtn) {
    saveStatusBtn.addEventListener("click", async () => {
        if (!selectedOrderId) return;
        const newStatus = document.getElementById("detail-status-select").value;

        saveStatusBtn.disabled = true;
        saveStatusBtn.textContent = "Updating Ticket Status...";

        try {
            const response = await fetch(`/api/orders/${selectedOrderId}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-Admin-Passcode": currentPasscode
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                // Update local list
                const idx = adminOrders.findIndex(o => o.id === selectedOrderId);
                if (idx !== -1) {
                    adminOrders[idx].status = newStatus;
                }
                
                // Refresh
                compileAnalyticsMetrics();
                renderOrdersTable();
                
                document.getElementById("order-detail-modal").classList.remove("active");
                window.showToast(`Order updated to status: ${newStatus}`);
            } else {
                throw new Error("Failed to update status on database");
            }
        } catch (err) {
            console.error("Workflow status update failed:", err);
            window.showToast("Database connection error updating status", "error");
        } finally {
            saveStatusBtn.disabled = false;
            saveStatusBtn.textContent = "Update Status";
        }
    });
}

/* ==========================================
   6. SELLER PRODUCT INVENTORY CATALOG CRUD
   ========================================== */
function renderInventoryTable() {
    const tbody = document.getElementById("inventory-table-body");
    const searchVal = document.getElementById("inventory-search").value.toLowerCase();
    if (!tbody) return;

    const filtered = adminProducts.filter(p => {
        return p.name.toLowerCase().includes(searchVal) ||
               p.category.toLowerCase().includes(searchVal) ||
               p.id.toLowerCase().includes(searchVal);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color:var(--text-muted);">
            No inventory products found matching '${searchVal}'.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(prod => {
        const isLow = prod.stock < 10 && prod.stock > 0;
        const isEmpty = prod.stock <= 0;
        
        let stockIndicator = `<strong>${prod.stock}</strong>`;
        if (isEmpty) {
            stockIndicator = `<span class="stock-warning-indicator empty">✕ Empty (0)</span>`;
        } else if (isLow) {
            stockIndicator = `<span class="stock-warning-indicator low">⚠ Low (${prod.stock})</span>`;
        }

        return `
            <tr id="row-prod-${prod.id}">
                <td><span style="font-size:0.8rem; font-family:monospace; color:var(--text-muted);">${prod.id}</span></td>
                <td>
                    <div><strong>${prod.name}</strong></div>
                    <div style="font-size:0.75rem; color:var(--text-muted); max-width: 250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        ${prod.description}
                    </div>
                </td>
                <td><span class="glow-badge" style="box-shadow:none; padding:2px 8px; font-size:0.7rem; border-color:var(--border-card);">${prod.category}</span></td>
                <td><strong>₹${prod.price.toFixed(2)}</strong></td>
                <td><span style="font-size:0.85rem; color:var(--text-muted);">${prod.dosage} (${prod.type})</span></td>
                <td>
                    ${prod.requiresPrescription ? `
                        <span class="status-pill Cancelled" style="font-size:0.65rem; border-radius:4px;">Yes (Rx)</span>
                    ` : `
                        <span style="font-size:0.8rem; color:var(--text-muted);">No</span>
                    `}
                </td>
                <td>${stockIndicator}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button class="table-action-btn" onclick="openProductEditForm('${prod.id}')" title="Modify item details">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button class="table-action-btn" onclick="quickStockAdjust('${prod.id}', 10)" title="Quick Stock Restock (+10)">
                            +10
                        </button>
                        <button class="table-action-btn danger" onclick="handleDeleteProduct('${prod.id}')" title="Delete product item">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function setupInventoryCrudControls() {
    const searchInput = document.getElementById("inventory-search");
    if (searchInput) {
        searchInput.addEventListener("input", renderInventoryTable);
    }

    const addBtn = document.getElementById("open-add-product-btn");
    const addModal = document.getElementById("product-form-modal");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            // Clear fields for fresh insert
            document.getElementById("product-edit-form").reset();
            document.getElementById("form-product-id").value = "";
            document.getElementById("product-modal-title").textContent = "Add New Medicine Product";
            addModal.classList.add("active");
        });
    }

    // Save Form Trigger callback
    const saveBtn = document.getElementById("product-form-save-btn");
    if (saveBtn) {
        saveBtn.addEventListener("click", handleSaveProductForm);
    }
}

window.quickStockAdjust = async function(productId, amount) {
    const prod = adminProducts.find(p => p.id === productId);
    if (!prod) return;

    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Passcode": currentPasscode
            },
            body: JSON.stringify({ stock: prod.stock + amount })
        });

        if (response.ok) {
            prod.stock += amount;
            compileAnalyticsMetrics();
            renderInventoryTable();
            window.showToast(`Restocked ${prod.name} by +${amount}`);
        } else {
            throw new Error("Failed to adjust stock on server");
        }
    } catch (err) {
        console.error("Quick stock adjustment failed:", err);
        window.showToast("Error updating stock levels", "error");
    }
};

window.openProductEditForm = function(productId) {
    const prod = adminProducts.find(p => p.id === productId);
    if (!prod) return;

    document.getElementById("form-product-id").value = prod.id;
    document.getElementById("form-product-name").value = prod.name;
    document.getElementById("form-product-category").value = prod.category;
    document.getElementById("form-product-type").value = prod.type;
    document.getElementById("form-product-price").value = prod.price;
    document.getElementById("form-product-stock").value = prod.stock;
    document.getElementById("form-product-dosage").value = prod.dosage;
    document.getElementById("form-product-rx").checked = prod.requiresPrescription;
    document.getElementById("form-product-desc").value = prod.description;

    document.getElementById("product-modal-title").textContent = "Modify Medication details";
    document.getElementById("product-form-modal").classList.add("active");
};

async function handleSaveProductForm() {
    const name = document.getElementById("form-product-name").value.trim();
    const category = document.getElementById("form-product-category").value;
    const type = document.getElementById("form-product-type").value;
    const price = parseFloat(document.getElementById("form-product-price").value);
    const stock = parseInt(document.getElementById("form-product-stock").value);
    const dosage = document.getElementById("form-product-dosage").value.trim();
    const requiresPrescription = document.getElementById("form-product-rx").checked;
    const description = document.getElementById("form-product-desc").value.trim();

    if (!name || isNaN(price) || isNaN(stock) || !dosage || !description) {
        window.showToast("Please fill out all product details", "error");
        return;
    }

    const payload = {
        name, category, type, price, stock, dosage, requiresPrescription, description
    };

    const targetId = document.getElementById("form-product-id").value;
    const saveBtn = document.getElementById("product-form-save-btn");
    
    saveBtn.disabled = true;
    saveBtn.textContent = "Writing catalog details...";

    try {
        let url = "/api/products";
        let method = "POST";

        if (targetId) {
            // Edit existing item
            url = `/api/products/${targetId}`;
            method = "PUT";
        }

        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "X-Admin-Passcode": currentPasscode
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            
            if (targetId) {
                // Update local array element
                const idx = adminProducts.findIndex(p => p.id === targetId);
                if (idx !== -1) adminProducts[idx] = data;
                window.showToast(`Updated medication details for ${name}`);
            } else {
                // Add new element to array
                adminProducts.push(data);
                window.showToast(`Added new product catalog entry: ${name}`);
            }

            compileAnalyticsMetrics();
            renderInventoryTable();
            document.getElementById("product-form-modal").classList.remove("active");
        } else {
            throw new Error("Failed to write to database");
        }
    } catch (err) {
        console.error("Inventory form save error:", err);
        window.showToast("Database insertion error", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Product";
    }
}

window.handleDeleteProduct = async function(productId) {
    const prod = adminProducts.find(p => p.id === productId);
    if (!prod) return;

    if (!confirm(`Are you absolutely sure you want to delete '${prod.name}' from Sweta Medical inventory?`)) return;

    try {
        const response = await fetch(`/api/products/${productId}`, {
            method: "DELETE",
            headers: { "X-Admin-Passcode": currentPasscode }
        });

        if (response.ok) {
            adminProducts = adminProducts.filter(p => p.id !== productId);
            compileAnalyticsMetrics();
            renderInventoryTable();
            window.showToast("Product deleted successfully");
        } else {
            throw new Error("Failed to remove product from database");
        }
    } catch (err) {
        console.error("Product deletion error:", err);
        window.showToast("Database deletion error", "error");
    }
};

/* ==========================================
   7. GLOBAL VIEW CLOSE SYSTEM
   ========================================== */
function setupGlobalModalClosers() {
    // Zoom modal closer
    const zoomOverlay = document.getElementById("zoom-overlay");
    const closeZoomBtn = document.getElementById("close-zoom-overlay");
    if (zoomOverlay) {
        [zoomOverlay, closeZoomBtn].forEach(el => {
            if (el) {
                el.addEventListener("click", () => zoomOverlay.classList.remove("active"));
            }
        });
    }

    // Order detail modal closer
    const orderModal = document.getElementById("order-detail-modal");
    const closeOrderBtn = document.getElementById("close-order-detail-modal");
    const detailCloseBtn = document.getElementById("detail-close-btn");
    if (orderModal) {
        [closeOrderBtn, detailCloseBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener("click", () => orderModal.classList.remove("active"));
            }
        });
    }

    // Product edit form modal closer
    const prodModal = document.getElementById("product-form-modal");
    const closeProdBtn = document.getElementById("close-product-form-modal");
    const prodCancelBtn = document.getElementById("product-form-cancel-btn");
    if (prodModal) {
        [closeProdBtn, prodCancelBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener("click", () => prodModal.classList.remove("active"));
            }
        });
    }
}
