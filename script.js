// --- SISTEMA DE NAVEGACIÓN SPA ---
function navigateTo(viewId) {
    const views = document.querySelectorAll('.view');
    views.forEach(view => {
        view.classList.remove('active');
    });

    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
    }
    registerEvent('navigation', { view: viewId });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

const apiBase = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

async function registerEvent(type, details = {}) {
    try {
        await fetch(`${apiBase}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, details })
        });
    } catch (error) {
        console.warn('No se pudo registrar el evento:', error);
    }
}

async function sendApiRequest(endpoint, payload) {
    const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación');
    return data;
}

const products = {
    crm: { name: 'Lumina CRM', price: 29 },
    shield: { name: 'DataShield Pro', price: 49 },
    analytics: { name: 'Analytics Hub', price: 39 },
    web: { name: 'Desarrollo Web a Medida', price: 899 },
    ia: { name: 'Automatización con IA', price: 599 },
    seo: { name: 'Posicionamiento SEO', price: 249 },
    design: { name: 'Diseño UX/UI', price: 449 },
    cloud: { name: 'Migración a la nube', price: 699 },
    support: { name: 'Soporte Premium', price: 99 }
};
let cart = [];

function addToCart(productId) {
    cart.push(productId);
    registerEvent('cart_add', { productId });
    updateCartCount();
    openCart();
}

function updateCartCount() {
    document.getElementById('cart-count').textContent = cart.length;
}

function getCartTotal() {
    return cart.reduce((total, productId) => total + products[productId].price, 0);
}

function openCart() {
    const items = cart.length
        ? cart.map((productId, index) => `<div class="cart-item"><span>${products[productId].name}</span><strong>${products[productId].price.toFixed(2).replace('.', ',')} €</strong><button onclick="removeFromCart(${index})" aria-label="Eliminar producto">×</button></div>`).join('')
        : '<p class="empty-cart">Tu carrito está vacío. Añade un producto para continuar.</p>';
    const checkoutButton = cart.length ? '<button class="btn-primary checkout-button" onclick="showCheckout()">Pagar con tarjeta</button>' : '';

    modalBody.innerHTML = `<h2>Tu carrito</h2><div class="cart-list">${items}</div><div class="cart-total"><span>Total mensual</span><strong>${getCartTotal().toFixed(2).replace('.', ',')} €</strong></div>${checkoutButton}`;
    modal.style.display = 'block';
}

function removeFromCart(index) {
    const productId = cart[index];
    cart.splice(index, 1);
    registerEvent('cart_remove', { productId });
    updateCartCount();
    openCart();
}

function showCheckout() {
    modalBody.innerHTML = `
        <h2>Pago con tarjeta</h2>
        <p class="secure-note">Modo demostración. No se realizará ningún cargo real.</p>
        <div class="checkout-total">Total del pedido: <strong>${getCartTotal().toFixed(2).replace('.', ',')} € / mes</strong></div>
        <form class="payment-form" autocomplete="off" onsubmit="completePayment(event)">
            <label>Nombre del comprador<input name="buyerName" required type="text" autocomplete="off" maxlength="100" placeholder="Nombre y apellidos"></label>
            <label>Número de tarjeta<input name="cardNumber" required type="text" inputmode="numeric" autocomplete="off" maxlength="19" placeholder="1234 5678 9012 3456" oninput="formatCardNumber(this)"></label>
            <div class="payment-row"><label>Vencimiento<input name="cardExpiry" required type="text" inputmode="numeric" autocomplete="off" maxlength="5" placeholder="MM/AA"></label><label>CVV<input name="cardCvv" required type="password" inputmode="numeric" autocomplete="off" maxlength="3" placeholder="123"></label></div>
            <button class="btn-primary checkout-button" type="submit">Pagar</button>
        </form>`;
}

function formatCardNumber(input) {
    input.value = input.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

async function completePayment(event) {
    event.preventDefault();
    const paymentForm = new FormData(event.target);
    const items = cart.map(productId => ({
        productId,
        name: products[productId].name,
        unitPrice: products[productId].price
    }));
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Procesando pago...';
    try {
        const result = await sendApiRequest('/api/orders', {
            items,
            buyerName: paymentForm.get('buyerName')
        });
        cart = [];
        updateCartCount();
        modalBody.innerHTML = `<div class="payment-success"><div class="success-icon">✓</div><h2>Pago realizado</h2><p>Compra #${result.orderId} registrada. Es una demostración; no se hizo ningún cargo.</p><button class="btn-primary" onclick="closeModal()">Continuar comprando</button></div>`;
    } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = 'Pagar';
        const serverAddress = window.location.protocol === 'file:' ? 'http://localhost:3000' : window.location.origin;
        alert(`No se pudo registrar el pedido. Comprueba que LuminaTech esté abierto en ${serverAddress}. Detalle: ${error.message}`);
    }
}

// --- BASE DE DATOS DE CONTENIDO PARA LOS MODALES ---
const modalData = {
    // Info de Productos
    'crm': {
        title: 'Lumina CRM',
        content: `
            <p>El CRM diseñado para empresas que odian los sistemas complejos.</p>
            <p><strong>Licencias desde:</strong> 29€ / usuario al mes.</p>
            <ul class="custom-list mt-2">
                <li>Gestión de embudos de ventas visuales.</li>
                <li>Automatización de emails comerciales.</li>
                <li>Integración directa con WhatsApp Business.</li>
            </ul>
        `
    },
    'shield': {
        title: 'DataShield Pro',
        content: `
            <p>La seguridad de tu empresa no es opcional. DataShield Pro cifra tus bases de datos y realiza respaldos automáticos cada hora.</p>
            <p>Recuperación ante desastres garantizada en menos de 15 minutos.</p>
        `
    },
    'analytics': {
        title: 'Analytics Hub',
        content: `
            <p>Toma decisiones basadas en datos reales, no en intuiciones. Conectamos todas tus fuentes de datos en un solo panel interactivo.</p>
        `
    },
    
    // Formulario de Contacto
    'general': {
        title: 'Hablemos de tu proyecto',
        content: `
            <p>Déjanos tus datos y un consultor técnico se pondrá en contacto contigo en menos de 24 horas.</p>
            <form onsubmit="submitContact(event)" style="display:flex; flex-direction:column; gap: 15px; margin-top:20px;">
                <input name="company" required type="text" placeholder="Nombre de la empresa" style="padding:10px; border-radius:5px; border:none;">
                <input name="email" required type="email" placeholder="Correo electrónico" style="padding:10px; border-radius:5px; border:none;">
                <textarea name="message" required rows="4" placeholder="¿En qué podemos ayudarte?" style="padding:10px; border-radius:5px; border:none;"></textarea>
                <button type="submit" class="btn-primary">Enviar Mensaje</button>
            </form>
        `
    }
};

async function submitContact(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    button.disabled = true;
    button.textContent = 'Enviando...';
    try {
        await sendApiRequest('/api/contacts', {
            company: formData.get('company'),
            email: formData.get('email'),
            message: formData.get('message')
        });
        modalBody.innerHTML = '<div class="payment-success"><div class="success-icon">✓</div><h2>Mensaje registrado</h2><p>Un consultor técnico se pondrá en contacto contigo en menos de 24 horas.</p><button class="btn-primary" onclick="closeModal()">Cerrar</button></div>';
    } catch (error) {
        button.disabled = false;
        button.textContent = 'Enviar Mensaje';
        alert(error.message);
    }
}

// --- GESTIÓN DE VENTANAS MODALES DINÁMICAS ---
const modal = document.getElementById('dynamicModal');
const modalBody = document.getElementById('modal-body');

function openModal(category, id) {
    const data = modalData[id];
    
    if (data) {
        // Inyectamos el HTML dinámico dentro del modal
        modalBody.innerHTML = `
            <h2>${data.title}</h2>
            ${data.content}
        `;
        modal.style.display = 'block';
    }
}

function closeModal() {
    modal.style.display = 'none';
}

// Cierra el modal al hacer clic en el fondo oscuro
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}