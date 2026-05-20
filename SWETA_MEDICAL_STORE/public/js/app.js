/* 🏥 GLOBAL INTERACTIVE SYSTEM & 3D ENGINE */

document.addEventListener("DOMContentLoaded", () => {
    // Initialize Theme
    initThemeManager();
    
    // Initialize 3D Capsule Mouse Interaction
    initCapsuleInteractive3D();
    
    // Global Toast Notification Mount
    window.showToast = createToastNotification;
});

/* ==========================================
   1. THEME MANAGER (DARK / LIGHT SYNC)
   ========================================== */
function initThemeManager() {
    const themeToggleBtn = document.getElementById("theme-toggle");
    if (!themeToggleBtn) return;

    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem("sweta-theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateToggleBtnIcon(savedTheme);

    themeToggleBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("sweta-theme", newTheme);
        updateToggleBtnIcon(newTheme);
        
        // Broadcast theme change for specialized widgets
        window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: newTheme } }));
        createToastNotification(`Switched to ${newTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}`, "info");
    });
}

function updateToggleBtnIcon(theme) {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    if (theme === "light") {
        btn.setAttribute("title", "Switch to Dark Mode");
    } else {
        btn.setAttribute("title", "Switch to Light Mode");
    }
}

/* ==========================================
   2. CUSTOM 3D CARD TILT MECHANISM (NO DEP)
   ========================================== */
/**
 * Applies 3D tilt interaction to HTML elements
 * @param {string} selector - CSS selector for target cards
 * @param {object} options - Custom coefficients for tilt degrees and perspective
 */
window.init3DTilt = function(selector, options = {}) {
    const cards = document.querySelectorAll(selector);
    const settings = {
        maxTilt: options.maxTilt || 15,         // Max rotation in degrees
        perspective: options.perspective || 1000, // 3D depth perspective
        scale: options.scale || 1.02,           // Hover scaling
        speed: options.speed || "300ms",         // Reset transition speed
        easing: options.easing || "cubic-bezier(0.25, 0.8, 0.25, 1)"
    };

    cards.forEach(card => {
        // Ensure card has proper structure for preserve-3d
        card.style.transformStyle = "preserve-3d";
        card.style.transition = `transform ${settings.speed} ${settings.easing}, box-shadow ${settings.speed} ${settings.easing}`;
        
        // Add perspective container wrapper if missing
        if (card.parentElement && !card.parentElement.classList.contains("interactive-3d-scene")) {
            card.style.perspective = `${settings.perspective}px`;
        }

        // Mouse Move Listener
        card.addEventListener("mousemove", (e) => {
            const cardRect = card.getBoundingClientRect();
            
            // X & Y position relative to the card's center (coordinates from -1 to 1)
            const mouseX = (e.clientX - cardRect.left) / cardRect.width;
            const mouseY = (e.clientY - cardRect.top) / cardRect.height;
            
            const tiltX = (settings.maxTilt / 2 - mouseY * settings.maxTilt).toFixed(2);
            const tiltY = (mouseX * settings.maxTilt - settings.maxTilt / 2).toFixed(2);
            
            // Apply 3D Rotation & Scaling
            card.style.transform = `perspective(${settings.perspective}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(${settings.scale}, ${settings.scale}, ${settings.scale})`;
            
            // Apply glow shadow bias relative to tilt
            const shadowX = -tiltY * 1.5;
            const shadowY = tiltX * 1.5;
            const theme = document.documentElement.getAttribute("data-theme");
            const glowColor = theme === "light" ? "rgba(185, 95, 45, 0.15)" : "rgba(0, 242, 254, 0.25)";
            card.style.boxShadow = `${shadowX}px ${shadowY}px 25px ${glowColor}, var(--shadow-card)`;

            // Push inner elements along Z-axis (Parallax Depth Effect)
            const elementsToTranslate = card.querySelectorAll(".tilt-inner-3d");
            elementsToTranslate.forEach(el => {
                const zDepth = el.getAttribute("data-z") || "30px";
                el.style.transform = `translateZ(${zDepth})`;
                el.style.transition = "transform 0.1s ease-out";
            });
        });

        // Mouse Leave (Reset card values smoothly)
        card.addEventListener("mouseleave", () => {
            card.style.transform = `perspective(${settings.perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            card.style.boxShadow = "var(--shadow-card), var(--shadow-glow)";
            
            const elementsToTranslate = card.querySelectorAll(".tilt-inner-3d");
            elementsToTranslate.forEach(el => {
                el.style.transform = "translateZ(0px)";
                el.style.transition = `transform ${settings.speed} ${settings.easing}`;
            });
        });
    });
};

/* ==========================================
   3. INTERACTIVE 3D CAPSULE RENDERING & DRAG
   ========================================== */
function initCapsuleInteractive3D() {
    const capsule = document.querySelector(".capsule-3d-model");
    const container = document.querySelector(".hero-3d-container");
    if (!capsule || !container) return;

    let isDragging = false;
    let previousMouseX = 0;
    let previousMouseY = 0;
    let rotationY = 0;
    let rotationX = 15; // default angle

    // Stop automated animation on mouse hover, apply interactive tracking
    container.addEventListener("mouseenter", () => {
        capsule.style.animation = "none";
    });

    container.addEventListener("mousemove", (e) => {
        if (isDragging) return; // Prioritize drag rotation

        const containerRect = container.getBoundingClientRect();
        // Compute displacement from center
        const centerX = containerRect.left + containerRect.width / 2;
        const centerY = containerRect.top + containerRect.height / 2;
        
        const deltaX = (e.clientX - centerX) / (containerRect.width / 2);
        const deltaY = (e.clientY - centerY) / (containerRect.height / 2);

        // Map mouse offset to slight rotations
        rotationY = deltaX * 45; // up to 45 deg Y
        rotationX = 15 - deltaY * 30; // up to 30 deg X

        capsule.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;
    });

    // Reset default looping animation when cursor leaves
    container.addEventListener("mouseleave", () => {
        if (!isDragging) {
            capsule.style.transition = "transform 1s ease";
            capsule.style.transform = "rotateX(15deg) rotateY(0deg)";
            setTimeout(() => {
                if (capsule.style.transform === "rotateX(15deg) rotateY(0deg)") {
                    capsule.style.transition = "";
                    capsule.style.animation = "rotate3d 12s infinite linear";
                }
            }, 1000);
        }
    });

    // Drag Interaction (Mouse down)
    capsule.addEventListener("mousedown", (e) => {
        isDragging = true;
        capsule.style.animation = "none";
        capsule.style.transition = "none";
        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
        e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - previousMouseX;
        const deltaY = e.clientY - previousMouseY;

        rotationY += deltaX * 0.5;
        rotationX -= deltaY * 0.5; // invert Y rotation axis

        // Clamp vertical rotation to avoid flipping upside down completely
        rotationX = Math.max(-60, Math.min(60, rotationX));

        capsule.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;

        previousMouseX = e.clientX;
        previousMouseY = e.clientY;
    });

    window.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            // Let the capsule settle back smoothly
            capsule.style.transition = "transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
            capsule.style.transform = "rotateX(15deg) rotateY(0deg)";
            setTimeout(() => {
                if (!isDragging && capsule.style.transform === "rotateX(15deg) rotateY(0deg)") {
                    capsule.style.transition = "";
                    capsule.style.animation = "rotate3d 12s infinite linear";
                }
            }, 800);
        }
    });
}

/* ==========================================
   4. GLASS TOAST NOTIFICATION UTILITY
   ========================================== */
function createToastNotification(message, type = "success") {
    // Find or create toast container
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.style.position = "fixed";
        container.style.top = "20px";
        container.style.right = "20px";
        container.style.zIndex = "99999";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "10px";
        container.style.maxWidth = "350px";
        container.style.width = "90%";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    
    // Base visual styling via JS to guarantee rendering
    toast.style.background = "var(--bg-card)";
    toast.style.border = "1px solid var(--border-card)";
    toast.style.backdropFilter = "blur(12px)";
    toast.style.webkitBackdropFilter = "blur(12px)";
    toast.style.borderRadius = "12px";
    toast.style.padding = "14px 20px";
    toast.style.color = "var(--text-main)";
    toast.style.boxShadow = "var(--shadow-card), var(--shadow-glow)";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "12px";
    toast.style.transform = "translateX(120%) scale(0.9)";
    toast.style.opacity = "0";
    toast.style.transition = "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease";
    toast.style.fontSize = "0.9rem";
    toast.style.fontWeight = "600";

    // Set colors by type
    let icon = "✓";
    if (type === "error") {
        toast.style.borderColor = "var(--accent-red)";
        toast.style.boxShadow = "0 4px 15px rgba(255, 60, 95, 0.15)";
        icon = "✕";
        toast.innerHTML = `<span style="color: var(--accent-red); font-size: 1.2rem; font-weight: 800;">${icon}</span> <span>${message}</span>`;
    } else if (type === "info") {
        toast.style.borderColor = "var(--accent-blue)";
        icon = "ℹ";
        toast.innerHTML = `<span style="color: var(--accent-blue); font-size: 1.2rem; font-weight: 800;">${icon}</span> <span>${message}</span>`;
    } else if (type === "warning") {
        toast.style.borderColor = "var(--accent-yellow)";
        icon = "⚠";
        toast.innerHTML = `<span style="color: var(--accent-yellow); font-size: 1.2rem; font-weight: 800;">${icon}</span> <span>${message}</span>`;
    } else {
        toast.style.borderColor = "var(--accent-cyan)";
        toast.innerHTML = `<span style="color: var(--accent-cyan); font-size: 1.2rem; font-weight: 800;">${icon}</span> <span>${message}</span>`;
    }

    container.appendChild(toast);

    // Trigger sliding animation
    requestAnimationFrame(() => {
        toast.style.transform = "translateX(0) scale(1)";
        toast.style.opacity = "1";
    });

    // Remove notification after delay
    setTimeout(() => {
        toast.style.transform = "translateX(120%) scale(0.9)";
        toast.style.opacity = "0";
        setTimeout(() => {
            if (toast.parentElement) {
                container.removeChild(toast);
            }
        }, 400);
    }, 3500);
}
