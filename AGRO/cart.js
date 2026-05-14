// ==========================================
// КОШИК — єдиний файл для всіх сторінок
// Щоб змінити кошик — редагуйте лише цей файл
// ==========================================

(function () {
    const cartHTML = `
    <div id="cart-modal" class="modal" onclick="if(event.target==this)closeCart()">
        <div class="cart-ui">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h2 style="font-family:'Playfair Display'; margin:0;">Ваше замовлення</h2>
                <button onclick="clearCart()" style="background:none; border:1px solid #ff4d4d; color:#ff4d4d; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:bold; display:flex; align-items:center; gap:5px;">
                    🗑️ Очистити
                </button>
            </div>

            <div id="cart-list"></div>

            <div style="font-size:1.4rem; font-weight:800; margin:20px 0; text-align:right; color:var(--green);">
                Разом: <span id="cart-total">0</span> грн
            </div>

            <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px; padding:0 10px;">
                <button class="btn" onclick="sendToTelegram()" style="background:#0088cc; color:white; padding:14px; font-weight:bold; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:8px; font-size:1rem;">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" width="22" style="filter:brightness(0) invert(1);"> Оформити замовлення
                </button>
            </div>

            <button class="btn" style="background:#eee; color:#333; margin-top:10px;" onclick="closeCart()">
                Продовжити покупки
            </button>
        </div>
    </div>`;

    // Вставляємо кошик у контейнер
    const container = document.getElementById('cart-modal-container');
    if (container) container.innerHTML = cartHTML;
})();
