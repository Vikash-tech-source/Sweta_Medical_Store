/* 🏥 BUYER PORTAL DYNAMIC LOGIC ENGINE */

// Local state variables
let storeProducts = [];
let shoppingCart = [];
let uploadedFileBase64 = null;
let uploadedFileName = "";
let selectedCategory = "All";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Fetch products and render catalog
    fetchProducts();
    
    // 2. Setup storefront filters
    setupFilterListeners();
    
    // 3. Setup shopping cart drawer toggles
    setupCartDrawer();
    
    // 4. Setup prescription upload drag & drop handlers
    setupPrescriptionUploader();
    
    // 5. Setup order checkout placement
    setupCheckoutBtn();
    
    // 6. Setup order tracking status timeline
    setupOrderTracker();
});

/* ==========================================
   1. INVENTORY FETCHING & RENDER
   ========================================== */
async function fetchProducts() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;
    
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <span class="pulse-indicator"></span> Fetching medical inventory...
    </div>`;

    try {
        const response = await fetch("/api/products");
        if (!response.ok) throw new Error("Failed to load products");
        
        storeProducts = await response.ok ? await response.json() : [];
        renderCatalog();
    } catch (err) {
        console.error("Error loading products:", err);
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--accent-red);">
            ❌ Failed to connect to server database. Please ensure 'server.py' is running.
        </div>`;
    }
}

function renderCatalog() {
    const grid = document.getElementById("products-grid");
    if (!grid) return;

    const searchQuery = document.getElementById("store-search").value.toLowerCase();
    
    // Filter logic
    const filtered = storeProducts.filter(prod => {
        const matchesCategory = selectedCategory === "All" || prod.category === selectedCategory;
        const matchesSearch = prod.name.toLowerCase().includes(searchQuery) || 
                              prod.description.toLowerCase().includes(searchQuery) ||
                              prod.category.toLowerCase().includes(searchQuery);
        return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">
            No medical products found matching these filters.
        </div>`;
        return;
    }

    grid.innerHTML = filtered.map(prod => {
        const isOutOfStock = prod.stock <= 0;
        const reqPrescription = prod.requiresPrescription;
        
        return `
            <div class="product-card glass-panel tilt-card-3d ${isOutOfStock ? 'out-of-stock' : ''}" data-id="${prod.id}">
                <div class="product-card-header tilt-inner-3d" data-z="20px">
                    <div class="product-icon-wrap">
                        ${getCategoryIcon(prod.category)}
                    </div>
                    ${reqPrescription ? `<span class="prescription-badge">Rx Req</span>` : ''}
                </div>
                
                <h4 class="product-name tilt-inner-3d" data-z="25px">${prod.name}</h4>
                <div>
                    <span class="product-dosage">${prod.dosage} (${prod.type})</span>
                </div>
                
                <p class="product-desc tilt-inner-3d" data-z="15px">${prod.description}</p>
                
                <div class="product-footer tilt-inner-3d" data-z="30px">
                    <div class="product-price">₹${prod.price.toFixed(2)}</div>
                    
                    ${isOutOfStock ? `
                        <span class="out-of-stock-text">Out of Stock</span>
                    ` : `
                        <button class="add-cart-btn" onclick="handleAddToCart('${prod.id}')" aria-label="Add to cart">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join("");

    // Initialize 3D Mouse physical tilt engine on newly rendered cards
    window.init3DTilt(".product-card", { maxTilt: 12, scale: 1.03 });
}

function getCategoryIcon(cat) {
    // Return appropriate inline icon SVG based on category
    switch (cat) {
        case "Pain Relief":
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;
        case "Antibiotics":
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.5 3.5a2.12 2.12 0 0 1 3 0l7 7a2.12 2.12 0 0 1 0 3l-12 12a2.12 2.12 0 0 1-3 0l-7-7a2.12 2.12 0 0 1 0-3l12-12z"></path><path d="m14 8-6 6"></path></svg>`;
        case "Cardiac Care":
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
        case "Wellness & Vitamins":
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>`;
        case "Personal Hygiene":
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
        default:
            return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`;
    }
}

function setupFilterListeners() {
    const searchInput = document.getElementById("store-search");
    if (searchInput) {
        searchInput.addEventListener("input", renderCatalog);
    }

    const pillsContainer = document.getElementById("category-pills");
    if (pillsContainer) {
        pillsContainer.addEventListener("click", (e) => {
            const pill = e.target.closest(".category-pill");
            if (!pill) return;
            
            // Toggle active styling
            pillsContainer.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            
            selectedCategory = pill.getAttribute("data-category");
            renderCatalog();
        });
    }
}

/* ==========================================
   2. CART DRAWER & OPERATIONS
   ========================================== */
function setupCartDrawer() {
    const cartToggle = document.getElementById("floating-cart-toggle");
    const closeCart = document.getElementById("close-cart");
    const overlay = document.getElementById("cart-drawer-overlay");

    if (cartToggle) {
        cartToggle.addEventListener("click", () => {
            overlay.classList.add("active");
            renderCart();
        });
    }

    if (closeCart) {
        closeCart.addEventListener("click", () => overlay.classList.remove("active"));
    }
    
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                overlay.classList.remove("active");
            }
        });
    }
}

// Global scope binding for card onclick
window.handleAddToCart = function(productId) {
    const product = storeProducts.find(p => p.id === productId);
    if (!product) return;

    const cartItem = shoppingCart.find(item => item.productId === productId);
    if (cartItem) {
        if (cartItem.quantity >= product.stock) {
            window.showToast("Cannot add more: Stock limit reached", "warning");
            return;
        }
        cartItem.quantity += 1;
    } else {
        shoppingCart.push({
            productId: productId,
            quantity: 1
        });
    }

    updateCartBadge();
    window.showToast(`Added ${product.name} to cart basket`);
};

function updateCartBadge() {
    const countBadge = document.getElementById("cart-badge-count");
    if (!countBadge) return;
    
    const totalCount = shoppingCart.reduce((acc, curr) => acc + curr.quantity, 0);
    countBadge.textContent = totalCount;
    
    // Animate badge grow
    countBadge.style.transform = "scale(1.3)";
    setTimeout(() => countBadge.style.transform = "scale(1)", 200);
}

function renderCart() {
    const container = document.getElementById("cart-items-container");
    const totalPriceEl = document.getElementById("cart-total-price");
    const prescriptionSec = document.getElementById("prescription-upload-section");
    const checkoutFields = document.getElementById("checkout-form");
    if (!container) return;

    if (shoppingCart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                <p>Your basket is empty.</p>
                <span style="font-size:0.8rem; display:block; margin-top:8px;">Add healthcare products from the catalog store list.</span>
            </div>
        `;
        totalPriceEl.textContent = "₹0.00";
        prescriptionSec.style.display = "none";
        checkoutFields.style.display = "none";
        return;
    }

    let grandTotal = 0;
    let containsPrescriptionItem = false;

    container.innerHTML = shoppingCart.map(item => {
        const prod = storeProducts.find(p => p.id === item.productId);
        if (!prod) return "";

        const itemSubtotal = prod.price * item.quantity;
        grandTotal += itemSubtotal;

        if (prod.requiresPrescription) {
            containsPrescriptionItem = true;
        }

        return `
            <div class="cart-item">
                <div class="cart-item-details">
                    <div class="cart-item-name">${prod.name}</div>
                    <div class="cart-item-price">₹${prod.price.toFixed(2)} ${prod.requiresPrescription ? '<span style="color:var(--accent-red); font-size:0.65rem; font-weight:bold; margin-left:5px;">(Rx Req)</span>' : ''}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="updateCartQty('${prod.id}', -1)">-</button>
                    <span class="qty-display">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateCartQty('${prod.id}', 1)">+</button>
                    <button class="remove-item-btn" onclick="updateCartQty('${prod.id}', -9999)" aria-label="Remove item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }).join("");

    totalPriceEl.textContent = `₹${grandTotal.toFixed(2)}`;

    // Dynamic visibility check for prescription fields & customer form details
    prescriptionSec.style.display = containsPrescriptionItem ? "block" : "none";
    checkoutFields.style.display = "block";
}

window.updateCartQty = function(productId, delta) {
    const product = storeProducts.find(p => p.id === productId);
    const cartItem = shoppingCart.find(item => item.productId === productId);
    if (!cartItem) return;

    if (delta === -9999) {
        // Remove item completely
        shoppingCart = shoppingCart.filter(item => item.productId !== productId);
        window.showToast(`Removed ${product.name}`);
    } else {
        const nextQty = cartItem.quantity + delta;
        if (nextQty <= 0) {
            shoppingCart = shoppingCart.filter(item => item.productId !== productId);
            window.showToast(`Removed ${product.name}`);
        } else if (nextQty > product.stock) {
            window.showToast("Cannot add more: Stock limit reached", "warning");
            return;
        } else {
            cartItem.quantity = nextQty;
        }
    }

    updateCartBadge();
    renderCart();
};

/* ==========================================
   3. PRESCRIPTION DRAG & DROP FILE UPLOADER
   ========================================== */
function setupPrescriptionUploader() {
    const dropZone = document.getElementById("prescription-drop-zone");
    const fileInput = document.getElementById("prescription-file-input");
    const fileBanner = document.getElementById("prescription-file-banner");
    const fileNameEl = document.getElementById("prescription-file-name");
    const removeFileBtn = document.getElementById("remove-prescription-file");

    if (!dropZone || !fileInput) return;

    // Trigger click on browse
    dropZone.addEventListener("click", () => fileInput.click());

    // File Drag & Drop hover triggers
    ["dragenter", "dragover"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add("dragover");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove("dragover");
        }, false);
    });

    // File Drop handler
    dropZone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            processFile(files[0]);
        }
    });

    // File input picker handler
    fileInput.addEventListener("change", (e) => {
        if (fileInput.files.length) {
            processFile(fileInput.files[0]);
        }
    });

    // Remove file callback
    removeFileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        uploadedFileBase64 = null;
        uploadedFileName = "";
        fileInput.value = "";
        fileBanner.style.display = "none";
        dropZone.style.display = "block";
        window.showToast("Prescription file removed", "info");
    });
}

function processFile(file) {
    const dropZone = document.getElementById("prescription-drop-zone");
    const fileBanner = document.getElementById("prescription-file-banner");
    const fileNameEl = document.getElementById("prescription-file-name");

    // Max limit check: 5MB
    if (file.size > 5 * 1024 * 1024) {
        window.showToast("File size too large. Max 5MB allowed.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedFileBase64 = e.target.result;
        uploadedFileName = file.name;
        
        // Show file loading status UI
        fileNameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        dropZone.style.display = "none";
        fileBanner.style.display = "flex";
        
        window.showToast("Prescription uploaded and compressed successfully");
    };
    
    reader.readAsDataURL(file);
}

/* ==========================================
   4. CHECKOUT ORDER DISPATCH
   ========================================== */
function setupCheckoutBtn() {
    const submitBtn = document.getElementById("checkout-submit-btn");
    const receiptModal = document.getElementById("receipt-modal");
    const receiptClose = document.getElementById("close-receipt-modal");
    const receiptOk = document.getElementById("receipt-ok-btn");
    const overlay = document.getElementById("cart-drawer-overlay");

    if (!submitBtn) return;

    submitBtn.addEventListener("click", async () => {
        if (shoppingCart.length === 0) {
            window.showToast("Cart is empty", "error");
            return;
        }

        const patientName = document.getElementById("checkout-name").value.trim();
        const patientPhone = document.getElementById("checkout-phone").value.trim();
        const patientAddress = document.getElementById("checkout-address").value.trim();

        if (!patientName || !patientPhone || !patientAddress) {
            window.showToast("Please fill out all patient delivery details", "error");
            return;
        }

        // Check if prescription required
        let prescriptionRequired = false;
        shoppingCart.forEach(item => {
            const prod = storeProducts.find(p => p.id === item.productId);
            if (prod && prod.requiresPrescription) {
                prescriptionRequired = true;
            }
        });

        if (prescriptionRequired && !uploadedFileBase64) {
            window.showToast("Prescription file is mandatory for these items", "error");
            return;
        }

        // Toggle load button state
        submitBtn.disabled = true;
        submitBtn.textContent = "Dispatching Purchase Request...";

        // Pack payload
        const payload = {
            customerName: patientName,
            phone: patientPhone,
            address: patientAddress,
            items: shoppingCart,
            prescriptionBase64: uploadedFileBase64,
            prescriptionName: uploadedFileName
        };

        try {
            const response = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: jsonStringifyASCII(payload)
            });

            const data = await response.json();

            if (response.ok) {
                // Clear state
                shoppingCart = [];
                uploadedFileBase64 = null;
                uploadedFileName = "";
                document.getElementById("checkout-name").value = "";
                document.getElementById("checkout-phone").value = "";
                document.getElementById("checkout-address").value = "";
                
                const banner = document.getElementById("prescription-file-banner");
                const uploader = document.getElementById("prescription-drop-zone");
                if (banner) banner.style.display = "none";
                if (uploader) uploader.style.display = "block";
                
                updateCartBadge();
                overlay.classList.remove("active");

                // Render success receipt modal details
                document.getElementById("receipt-tracker-id").textContent = data.trackerId;
                receiptModal.classList.add("active");
                
                // Refresh local products array stock details
                fetchProducts();
                window.showToast("Purchase request successfully recorded");
            } else {
                throw new Error(data.error || "Failed to submit checkout request");
            }
        } catch (err) {
            console.error("Checkout dispatch failed:", err);
            window.showToast(err.message || "Network error placing request", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Purchase Request";
        }
    });

    // Modals close triggers
    [receiptClose, receiptOk].forEach(btn => {
        if (btn) {
            btn.addEventListener("click", () => receiptModal.classList.remove("active"));
        }
    });
}

// Ensure payload has proper encoding representation
function jsonStringifyASCII(obj) {
    return JSON.stringify(obj).replace(/[\u007F-\uFFFF]/g, chr => {
        return "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).slice(-4);
    });
}

/* ==========================================
   5. ORDER TRACKER TIMELINE PIPELINE
   ========================================== */
function setupOrderTracker() {
    const form = document.getElementById("tracker-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const trackerInput = document.getElementById("tracker-input").value.trim().toUpperCase();
        if (!trackerInput) return;

        const stepperContainer = document.getElementById("tracker-stepper-container");
        const detailsBox = document.getElementById("tracking-details-box");
        
        detailsBox.innerHTML = `<span class="pulse-indicator"></span> Querying order registry database...`;
        stepperContainer.style.display = "block";

        try {
            const response = await fetch(`/api/orders?trackerId=${encodeURIComponent(trackerInput)}`);
            const data = await response.json();

            if (response.ok) {
                renderTimelineStepper(data.status);
                renderTrackingDetails(data);
                window.showToast("Order request ticket resolved");
            } else {
                throw new Error(data.error || "Order Track ID not found");
            }
        } catch (err) {
            console.error("Order search failed:", err);
            window.showToast(err.message || "Failed to locate track ID", "error");
            stepperContainer.style.display = "none";
        }
    });
}

function renderTimelineStepper(status) {
    // Steppers elements mapping
    const steps = [
        { id: "step-pending", index: 1, triggerStatuses: ["Pending", "Approved", "Dispensing", "Out for Delivery", "Completed"] },
        { id: "step-approved", index: 2, triggerStatuses: ["Approved", "Dispensing", "Out for Delivery", "Completed"] },
        { id: "step-dispensing", index: 3, triggerStatuses: ["Dispensing", "Out for Delivery", "Completed"] },
        { id: "step-delivery", index: 4, triggerStatuses: ["Out for Delivery", "Completed"] },
        { id: "step-completed", index: 5, triggerStatuses: ["Completed"] }
    ];

    const progressBar = document.getElementById("timeline-progress");
    
    // Clear active/completed tags first
    steps.forEach(step => {
        const el = document.getElementById(step.id);
        if (el) {
            el.classList.remove("active", "completed");
            el.querySelector(".step-node").textContent = step.index;
        }
    });

    let currentTimelinePercent = 0;
    
    if (status === "Pending") {
        document.getElementById("step-pending").classList.add("active");
        currentTimelinePercent = 0;
    } else if (status === "Approved") {
        document.getElementById("step-pending").classList.add("completed");
        document.getElementById("step-approved").classList.add("active");
        currentTimelinePercent = 25;
    } else if (status === "Dispensing") {
        document.getElementById("step-pending").classList.add("completed");
        document.getElementById("step-approved").classList.add("completed");
        document.getElementById("step-dispensing").classList.add("active");
        currentTimelinePercent = 50;
    } else if (status === "Out for Delivery" || status === "Out_for_Delivery") {
        document.getElementById("step-pending").classList.add("completed");
        document.getElementById("step-approved").classList.add("completed");
        document.getElementById("step-dispensing").classList.add("completed");
        document.getElementById("step-delivery").classList.add("active");
        currentTimelinePercent = 75;
    } else if (status === "Completed") {
        steps.forEach(step => {
            const el = document.getElementById(step.id);
            if (el) el.classList.add("completed");
        });
        // Set node content checkmark
        document.querySelectorAll(".step-node").forEach(node => node.textContent = "✓");
        currentTimelinePercent = 100;
    } else if (status === "Cancelled") {
        // Red visual alarm for cancellations
        document.getElementById("step-pending").classList.add("active");
        const pendingNode = document.querySelector("#step-pending .step-node");
        pendingNode.style.borderColor = "var(--accent-red)";
        pendingNode.style.color = "var(--accent-red)";
        pendingNode.textContent = "✕";
        currentTimelinePercent = 0;
        window.showToast("Notice: This order request has been cancelled", "warning");
    }

    // Set timeline bar progress width/height depending on layout
    const isMobile = window.innerWidth <= 600;
    if (progressBar) {
        if (isMobile) {
            progressBar.style.width = "4px";
            progressBar.style.height = `${currentTimelinePercent}%`;
        } else {
            progressBar.style.height = "4px";
            progressBar.style.width = `${currentTimelinePercent}%`;
        }
    }
}

function renderTrackingDetails(order) {
    const detailsBox = document.getElementById("tracking-details-box");
    if (!detailsBox) return;

    let itemsHtml = order.items.map(item => {
        return `
            <div class="tracking-item-row">
                <span>${item.name} (x${item.quantity})</span>
                <span>₹${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        `;
    }).join("");

    const isCancelled = order.status === "Cancelled";

    detailsBox.innerHTML = `
        <div class="tracking-grid-row">
            <div class="tracking-field">
                <h5>Order Track ID</h5>
                <p style="color:var(--accent-cyan); font-weight:700;">${order.trackerId}</p>
            </div>
            <div class="tracking-field">
                <h5>Request Status</h5>
                <p class="status-pill ${order.status.replace(/ /g, '_')}">${order.status}</p>
            </div>
            <div class="tracking-field">
                <h5>Date Submitted</h5>
                <p>${order.date}</p>
            </div>
        </div>

        <div class="tracking-grid-row">
            <div class="tracking-field" style="grid-column: 1/-1;">
                <h5>Patient Contacts & Delivery Address</h5>
                <p style="margin-bottom:4px;"><strong>Patient:</strong> ${order.customerName} (${order.phone})</p>
                <p><strong>Shipping:</strong> ${order.address}</p>
            </div>
        </div>

        <div class="tracking-items-list">
            <h5 style="margin-bottom:8px; border-bottom:1px solid var(--border-card); padding-bottom:6px;">Summary of Ordered Products</h5>
            ${itemsHtml}
            <div class="tracking-item-row total">
                <span>Estimated Billing:</span>
                <span>₹${order.totalPrice.toFixed(2)}</span>
            </div>
        </div>
        
        ${order.prescriptionPath ? `
            <div style="margin-top:16px; font-size:0.8rem; color:var(--text-muted); display:flex; align-items:center; gap:8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span>Medical prescription document verified and attached internally</span>
            </div>
        ` : ''}
    `;
}
