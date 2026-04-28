// ==========================================
// ЗАВАНТАЖЕННЯ ТОВАРІВ З JSON (замість хардкоду)
// ==========================================

let products = [];

async function loadProducts() {
    try {
        const [prodResp, imgResp] = await Promise.all([
            fetch('products.json?v=' + Date.now()),
            fetch('img-map.json')
        ]);

        if (!prodResp.ok) throw new Error('products.json: HTTP ' + prodResp.status);

        const prod = await prodResp.json();

        // img-map.json може ще не існувати — це не критично
        let imgs = {};
        if (imgResp.ok) {
            imgs = await imgResp.json();
        }

        // Склеюємо: підставляємо фото з img-map за точною назвою товару
        products = prod.map(p => ({
            ...p,
            img: imgs[p.n] || p.img || ''
        }));

        console.log('✅ Завантажено товарів:', products.length);

        // Товари без фото — видно в консолі (F12)
        const noPhoto = products.filter(p => !p.img);
        if (noPhoto.length > 0) {
            console.warn('⚠️ Без фото (' + noPhoto.length + '):', noPhoto.map(p => p.n));
        }

    } catch(e) {
        console.error('❌ Помилка завантаження товарів:', e);
        // Сайт покаже порожній список, але не впаде
    }
}

// ==========================================
// ЛОГІКА РОБОТИ САЙТУ (ФІЛЬТРИ, КОШИК, VIBER)
// ==========================================

let cart = JSON.parse(localStorage.getItem('agronom_cart')) || [];
let visibleCount = 20;
let currentSubCat = 'Всі'; // Для підкатегорій (Гербіциди і т.д.)

// 1. Автоматичне визначення головної категорії за назвою файлу
const currentPage = window.location.pathname.split("/").pop();

function getInitialCategory() {
    if (currentPage === "chemicals.html")  return "АГРОХІМІКАТИ";
    if (currentPage === "import.html")     return "НАСІННЯ ІМПОРТНЕ";
    if (currentPage === "domestic.html")   return "НАСІННЯ ВІТЧИЗНЯНЕ";
    if (currentPage === "insects.html")    return "ПРОТИ КОМАХ";
    if (currentPage === "weight.html")     return "НАСІННЯ ВАГОВЕ";
    if (currentPage === "materials.html")  return "МАТЕРІАЛИ";
    if (currentPage === "drops.html")      return "КРАПЕЛЬНЕ ЗРОШУВАННЯ";
    if (currentPage === "animals.html")    return "ДЛЯ ТВАРИН";
    if (currentPage === "soil.html")       return "ГРУНТ";
    if (currentPage === "pots.html")       return "ГОРЩИКИ";
    if (currentPage === "sprouts.html")    return "РОЗСАДА";
    return "Всі"; // для index.html
}

let currentCat = getInitialCategory();

// 2. Основна функція фільтрації (Пошук + Категорія + Підкатегорія)
function applyFilters() {
    const searchEl = document.getElementById('search');
    const query = searchEl ? searchEl.value.toLowerCase() : '';

    const filtered = products.filter(p => {
        const matchMainCat = (currentCat === 'Всі' || p.c === currentCat);
        const matchSubCat  = (currentSubCat === 'Всі' || p.b === currentSubCat);
        const matchSearch  = p.n.toLowerCase().includes(query);
        // Якщо inStock визначено явно як false — приховуємо
        const inStock      = p.inStock !== false;
        return matchMainCat && matchSubCat && matchSearch && inStock;
    });

    render(filtered);

    // Категорії з підкатегоріями
    const catsWithSub = [
        "АГРОХІМІКАТИ", "НАСІННЯ ВІТЧИЗНЯНЕ", "НАСІННЯ ІМПОРТНЕ",
        "НАСІННЯ ВАГОВЕ", "МАТЕРІАЛИ", "КРАПЕЛЬНЕ ЗРОШУВАННЯ",
        "ГРУНТ", "ГОРЩИКИ", "ПРОТИ КОМАХ", "ДЛЯ ТВАРИН", "РОЗСАДА"
    ];

    if (catsWithSub.includes(currentCat)) {
        renderSubCategories();
    } else {
        const subContainer = document.getElementById('sub-cat-container');
        if (subContainer) subContainer.style.display = 'none';
    }
}

// 3. Створення кнопок підкатегорій (Гербіциди, Фунгіциди і т.д.)
function renderSubCategories() {
    const subContainer = document.getElementById('sub-cat-container');
    if (!subContainer) return;

    // Збираємо унікальні значення поля "b" саме для поточної сторінки
    const subCats = [...new Set(products
        .filter(p => p.c === currentCat && p.b)
        .map(p => p.b))];

    if (subCats.length === 0) {
        subContainer.style.display = 'none';
        return;
    }

    subContainer.style.display = 'flex';

    // Підбираємо правильний текст для першої кнопки "Всі"
    const allTextMap = {
        'АГРОХІМІКАТИ':        'Всі ЗЗР',
        'НАСІННЯ ВІТЧИЗНЯНЕ':  'Все насіння',
        'НАСІННЯ ІМПОРТНЕ':    'Всі виробники',
        'НАСІННЯ ВАГОВЕ':      'Всі культури',
        'МАТЕРІАЛИ':           'Всі матеріали',
        'КРАПЕЛЬНЕ ЗРОШУВАННЯ':'Весь полив',
        'ГРУНТ':               'Весь ґрунт',
        'ГОРЩИКИ':             'Всі товари',
        'ПРОТИ КОМАХ':         'Весь захист',
        'ДЛЯ ТВАРИН':         'Всі товари для тварин',
        'РОЗСАДА':             'Вся розсада',
    };
    const allText = allTextMap[currentCat] || 'Всі';

    let html = `<button class="cat-btn ${currentSubCat === 'Всі' ? 'active' : ''}" 
                onclick="setSubCat('Всі')">${allText}</button>`;

    // Виводимо кнопки (сортуємо за алфавітом)
    subCats.sort().forEach(sc => {
        html += `<button class="cat-btn ${currentSubCat === sc ? 'active' : ''}" 
                 onclick="setSubCat('${sc}')">${sc}</button>`;
    });

    subContainer.innerHTML = html;
}

// 4. Функція зміни підкатегорії
function setSubCat(sc) {
    currentSubCat = sc;
    visibleCount = 20;
    applyFilters();
}

// 5. Виведення карток товарів
function render(arr) {
    const grid = document.getElementById('grid');
    if (!grid) return;
    grid.innerHTML = '';

    const slice = arr.slice(0, visibleCount);

    // Іконки-плейсхолдери за категорією
    const catIcons = {
        'АГРОХІМІКАТИ':        '🧪',
        'ПРОТИ КОМАХ':         '🐛',
        'НАСІННЯ ІМПОРТНЕ':    '🌱',
        'НАСІННЯ ВІТЧИЗНЯНЕ':  '🌾',
        'НАСІННЯ ВАГОВЕ':      '⚖️',
        'МАТЕРІАЛИ':           '📦',
        'КРАПЕЛЬНЕ ЗРОШУВАННЯ':'💧',
        'ГРУНТ':               '🪴',
        'ГОРЩИКИ':             '🏺',
        'ДЛЯ ТВАРИН':         '🐾',
        'РОЗСАДА':             '🌿',
    };

    slice.forEach((p, idx) => {
        const safeName = p.n.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const isWeight = p.c === "НАСІННЯ ВАГОВЕ" ||
                 p.n.toLowerCase().includes(", кг") ||
                 p.n.toLowerCase().includes(", 1 кг") ||
                 p.n.toLowerCase().includes(" ваговий") ||
                 p.n.toLowerCase().endsWith(",кг");

        const icon = catIcons[p.c] || '🛒';

        // Блок з фото: якщо img заповнено — показуємо фото, інакше — іконка категорії
        const imgBlock = p.img
            ? `<div class="card-img-wrap">
                   <img src="${p.img}" alt="${p.n}" class="card-img"
                        onerror="this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'>${icon}</div>'">
               </div>`
            : `<div class="card-img-wrap">
                   <div class="card-img-placeholder">${icon}</div>
               </div>`;

        grid.innerHTML += `
            <div class="card">
                ${imgBlock}
                <h3>${p.n}</h3>
                <div class="price">${p.p.toFixed(2)} грн ${isWeight ? '<small>/кг</small>' : ''}</div>
                
                ${isWeight ? `
                    <div style="margin: 10px 0; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <input type="number" id="qty-${idx}" 
                               value="1" 
                               step="0.01" 
                               min="0.01" 
                               style="width: 80px; padding: 8px; border-radius: 6px; border: 2px solid #27ae60; text-align: center; font-weight: bold;">
                        <span style="font-weight: bold; color: #555;">кг</span>
                    </div>
                    <button class="btn" onclick="addWeightToCart('${safeName}', ${p.p}, ${idx})">ДОДАТИ</button>
                ` : `
                    <button class="btn" onclick="addToCart('${safeName}', ${p.p}, this)">ДОДАТИ</button>
                `}
            </div>
        `;
    });

    const loadMoreBtn = document.getElementById('loadMore');
    if (loadMoreBtn) loadMoreBtn.style.display = arr.length > visibleCount ? 'block' : 'none';
}

// 6. Кнопка "Показати ще"
function showMore() {
    visibleCount += 20;
    applyFilters();
}

// 7. Робота з кошиком (Локальне сховище)
function saveCart() {
    localStorage.setItem('agronom_cart', JSON.stringify(cart));
    updateCartUI();
}

function addToCart(name, price, btn) {
    const item = cart.find(i => i.n === name);
    if(item) {
        item.q++;
    } else {
        cart.push({n: name, p: price, q: 1});
    }
    saveCart();

    if (btn) {
        const oldText = btn.innerText;
        btn.innerText = "✓ ДОДАНО";
        btn.style.background = "#1a2e1a";
        setTimeout(() => { btn.innerText = oldText; btn.style.background = "var(--green)"; }, 800);
    }
}

function addWeightToCart(name, price, idx, unit) {
    const qtyInput = document.getElementById(`qty-${idx}`);
    const quantity = parseFloat(qtyInput.value);

    if (isNaN(quantity) || quantity <= 0) {
        alert("Вкажіть коректну кількість");
        return;
    }

    const fullName = `${name} (${unit})`;

    const item = cart.find(i => i.n === fullName);
    if (item) {
        item.q = parseFloat((item.q + quantity).toFixed(3));
    } else {
        cart.push({ n: fullName, p: price, q: quantity });
    }

    saveCart();

    const btn = qtyInput.parentElement.nextElementSibling;
    if (btn) {
        const oldText = btn.innerText;
        btn.innerText = "✓ ДОДАНО";
        btn.style.background = "#1a2e1a";
        setTimeout(() => {
            btn.innerText = oldText;
            btn.style.background = "var(--green)";
        }, 800);
    }
}

function updateCartUI() {
    const itemCount = cart.length;
    const totalSum = cart.reduce((sum, item) => sum + (item.p * item.q), 0);

    const countEl = document.getElementById('cart-count');
    const floatBtn = document.getElementById('cart-float');

    if (countEl) countEl.innerText = itemCount;

    if (floatBtn) {
        floatBtn.style.display = itemCount > 0 ? 'block' : 'none';
        floatBtn.innerHTML = `🛒 Кошик (${itemCount}) — ${totalSum.toFixed(2)} грн`;
    }
}

function openCart() {
    const modal = document.getElementById('cart-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    let total = 0;

    document.getElementById('cart-list').innerHTML = cart.map((i, idx) => {
        total += i.p * i.q;
        return `
            <div class="cart-item" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding:10px 0;">
                <div style="width:70%">${i.n}<br><small>${i.p} грн x ${i.q}</small></div>
                <div style="font-weight:bold">${(i.p * i.q).toFixed(2)}</div>
                <button onclick="removeItem(${idx})" style="background:none; border:none; color:red; cursor:pointer; font-size:1.2rem;">✕</button>
            </div>
        `;
    }).join('');
    document.getElementById('cart-total').innerText = total.toFixed(2);
}

function removeItem(idx) {
    cart.splice(idx, 1);
    saveCart();
    if(cart.length === 0) closeCart(); else openCart();
}

function closeCart() {
    document.getElementById('cart-modal').style.display = 'none';
}

function clearCart() {
    if (confirm("Ви впевнені, що хочете очистити весь кошик?")) {
        cart = [];

        if (typeof saveCart === 'function') {
            saveCart();
        } else {
            localStorage.setItem('cart', JSON.stringify([]));
        }

        updateCartUI();

        const cartCountEl = document.getElementById('cart-count');
        if (cartCountEl) cartCountEl.innerText = '0';

        const cartTotalEl = document.getElementById('cart-total');
        if (cartTotalEl) cartTotalEl.innerText = '0';

        const cartListEl = document.getElementById('cart-list');
        if (cartListEl) cartListEl.innerHTML = '<p style="text-align:center; padding: 20px;">Кошик порожній</p>';

        alert("Кошик очищено!");
    }
}

// ==========================================
// 8. ВІДПРАВКА ЗАМОВЛЕННЯ (TELEGRAM BOT)
// ==========================================

const TG_BOT_TOKEN = "8525390340:AAEEdlBM-R6pOCF8cPR7lmlHyvUsr-x4jhw";
const TG_CHAT_IDS  = ["949692506", "1846333153"]; // Руслан + Галина

function sendToTelegram() {
    if (cart.length === 0) return alert("Кошик порожній!");
    openOrderModal();
}

function openOrderModal() {
    const old = document.getElementById('order-modal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'order-modal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.6);
        display:flex; align-items:center; justify-content:center;
        z-index:9999; padding:16px; box-sizing:border-box;
    `;

    modal.innerHTML = `
        <div style="
            background:#fff; border-radius:16px; padding:28px 24px;
            width:100%; max-width:440px; box-shadow:0 8px 32px rgba(0,0,0,0.25);
            font-family:sans-serif; position:relative; box-sizing:border-box;
        ">
            <button onclick="closeOrderModal()" style="
                position:absolute; top:14px; right:16px;
                background:none; border:none; font-size:1.5rem;
                cursor:pointer; color:#888; line-height:1;
            ">✕</button>

            <h2 style="margin:0 0 20px; font-size:1.2rem; color:#1a2e1a;">
                📋 Оформлення замовлення
            </h2>

            <label style="display:block; margin-bottom:14px;">
                <span style="font-size:.85rem; color:#555; display:block; margin-bottom:4px;">
                    Прізвище та Ім'я *
                </span>
                <input id="ord-name" type="text" placeholder="Іваненко Іван"
                    style="width:100%; padding:10px 12px; border:1.5px solid #ccc;
                    border-radius:8px; font-size:1rem; box-sizing:border-box;">
            </label>

            <label style="display:block; margin-bottom:14px;">
                <span style="font-size:.85rem; color:#555; display:block; margin-bottom:4px;">
                    Номер телефону *
                </span>
                <input id="ord-phone" type="tel" placeholder="+380XXXXXXXXX"
                    style="width:100%; padding:10px 12px; border:1.5px solid #ccc;
                    border-radius:8px; font-size:1rem; box-sizing:border-box;">
            </label>

            <label style="display:block; margin-bottom:10px;">
                <span style="font-size:.85rem; color:#555; display:block; margin-bottom:6px;">
                    Спосіб отримання *
                </span>
                <div style="display:flex; gap:8px;">
                    <button type="button" id="delivery-np" onclick="selectDelivery('np')" style="
                        flex:1; padding:9px; border:2px solid #2d6a2d; border-radius:8px;
                        background:#2d6a2d; color:#fff; font-weight:bold; font-size:.9rem; cursor:pointer;">
                        🚚 Нова Пошта
                    </button>
                    <button type="button" id="delivery-self" onclick="selectDelivery('self')" style="
                        flex:1; padding:9px; border:2px solid #ccc; border-radius:8px;
                        background:#fff; color:#555; font-weight:bold; font-size:.9rem; cursor:pointer;">
                        🏪 Самовивіз
                    </button>
                </div>
            </label>

            <div id="ord-address-block" style="margin-bottom:14px;">
                <span style="font-size:.85rem; color:#555; display:block; margin-bottom:4px;">
                    Місто та відділення Нової Пошти *
                </span>
                <input id="ord-address" type="text" placeholder="Ковель, відділення №3"
                    style="width:100%; padding:10px 12px; border:1.5px solid #ccc;
                    border-radius:8px; font-size:1rem; box-sizing:border-box;">
                <span style="font-size:.78rem; color:#888; margin-top:4px; display:block;">
                    💳 Доставка за тарифами перевізника
                </span>
            </div>

            <label style="display:block; margin-bottom:20px;">
                <span style="font-size:.85rem; color:#555; display:block; margin-bottom:4px;">
                    Коментар (необов'язково)
                </span>
                <textarea id="ord-comment" rows="2" placeholder="Уточнення, побажання..."
                    style="width:100%; padding:10px 12px; border:1.5px solid #ccc;
                    border-radius:8px; font-size:1rem; resize:none; box-sizing:border-box;">
                </textarea>
            </label>

            <div id="ord-error" style="
                display:none; background:#ffe5e5; color:#c0392b;
                border-radius:8px; padding:10px 14px; margin-bottom:14px; font-size:.9rem;
            "></div>

            <p style="text-align:center; font-size:.85rem; color:#777; margin:0 0 12px;">
                Оберіть месенджер для оформлення:
            </p>
            <div style="display:flex; gap:10px;">
                <button id="ord-submit-btn" onclick="submitOrder('telegram')" style="
                    flex:1; padding:13px; background:#2d6a2d; color:#fff;
                    border:none; border-radius:10px; font-size:1rem;
                    font-weight:bold; cursor:pointer; transition:background .2s;
                ">
                    ✈️ TELEGRAM
                </button>
                <button id="ord-viber-btn" onclick="submitOrder('viber')" style="
                    flex:1; padding:13px; background:#7360f2; color:#fff;
                    border:none; border-radius:10px; font-size:1rem;
                    font-weight:bold; cursor:pointer; transition:background .2s;
                ">
                    📲 VIBER
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeOrderModal(); });
    document.getElementById('ord-name').focus();
}

function closeOrderModal() {
    const m = document.getElementById('order-modal');
    if (m) m.remove();
}

function selectDelivery(type) {
    const npBtn     = document.getElementById('delivery-np');
    const selfBtn   = document.getElementById('delivery-self');
    const addrBlock = document.getElementById('ord-address-block');

    if (type === 'np') {
        npBtn.style.background    = '#2d6a2d';
        npBtn.style.color         = '#fff';
        npBtn.style.borderColor   = '#2d6a2d';
        selfBtn.style.background  = '#fff';
        selfBtn.style.color       = '#555';
        selfBtn.style.borderColor = '#ccc';
        addrBlock.style.display   = 'block';
    } else {
        selfBtn.style.background  = '#2d6a2d';
        selfBtn.style.color       = '#fff';
        selfBtn.style.borderColor = '#2d6a2d';
        npBtn.style.background    = '#fff';
        npBtn.style.color         = '#555';
        npBtn.style.borderColor   = '#ccc';
        addrBlock.style.display   = 'none';
    }
    npBtn.dataset.active = type === 'np' ? '1' : '';
}

async function submitOrder(platform = 'telegram') {
    const name    = document.getElementById('ord-name').value.trim();
    const phone   = document.getElementById('ord-phone').value.trim();
    const comment = document.getElementById('ord-comment').value.trim() || 'немає';

    const npBtn      = document.getElementById('delivery-np');
    const isNP       = !npBtn || npBtn.dataset.active !== '';
    const addressRaw = document.getElementById('ord-address')?.value.trim() || '';
    const address    = isNP ? addressRaw : '🏪 Самовивіз';

    const errEl = document.getElementById('ord-error');
    errEl.style.display = 'none';

    if (!name)  return showOrderError('Введіть ваше Прізвище та Ім\'я');
    if (!phone) return showOrderError('Введіть номер телефону');
    if (isNP && !addressRaw) return showOrderError('Введіть адресу відділення Нової Пошти');

    let totalSum    = 0;
    let totalWeight = 0;
    let itemsText   = '';

    cart.forEach(item => {
        const price = parseFloat(item.p) || 0;
        const count = parseFloat(item.q) || 0;
        const sum   = price * count;
        totalSum   += sum;

        const isWeight = /\bкг\b/i.test(item.n) || /\(\s*кг\s*\)/i.test(item.n);
        if (isWeight) {
            totalWeight += count;
            itemsText += `• ${item.n} — ${count} кг (${sum.toFixed(2)} грн)\n`;
        } else {
            itemsText += `• ${item.n} — ${count} шт. (${sum.toFixed(2)} грн)\n`;
        }
    });

    let message = `🛒 <b>НОВЕ ЗАМОВЛЕННЯ</b>\n`;
    message += `──────────────────\n`;
    message += itemsText;
    message += `──────────────────\n`;
    if (totalWeight > 0) {
        message += `⚖️ Загальна вага: <b>${totalWeight.toFixed(2)} кг</b>\n`;
    }
    message += `💰 До оплати: <b>${totalSum.toFixed(2)} грн</b>\n\n`;
    message += `👤 Клієнт: ${name}\n`;
    message += `📞 Телефон: ${phone}\n`;
    message += `📍 Адреса: ${address}\n`;
    message += `💬 Коментар: ${comment}`;

    if (platform === 'viber') {
        const plainMessage = message.replace(/<b>/g,'').replace(/<\/b>/g,'');
        const VIBER_PHONE  = "380634625206";
        const viberUrl     = `viber://chat?number=${VIBER_PHONE}&draft=${encodeURIComponent(plainMessage)}`;
        const viberWebUrl  = `https://viber.me/${VIBER_PHONE}`;

        const copyAndOpen = () => {
            window.location.href = viberUrl;
            setTimeout(() => {
                if (document.hasFocus()) window.open(viberWebUrl, '_blank');
            }, 1200);
            closeOrderModal();
            finalizeOrder();
            showOrderSuccess('📲 Відкривається Viber — вставте текст із буфера і надішліть!');
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(plainMessage).then(copyAndOpen).catch(copyAndOpen);
        } else {
            copyAndOpen();
        }
        return;
    }

    // Telegram
    const btn = document.getElementById('ord-submit-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Надсилання...';

    try {
        const results = await Promise.all(
            TG_CHAT_IDS.map(chatId =>
                fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
                }).then(r => r.json())
            )
        );

        const allOk = results.every(d => d.ok);
        if (allOk) {
            closeOrderModal();
            finalizeOrder();
            showOrderSuccess();
        } else {
            throw new Error('Помилка надсилання одному з отримувачів');
        }
    } catch (err) {
        console.error('Order send error:', err);
        btn.disabled = false;
        btn.textContent = '✈️ TELEGRAM';
        showOrderError('Не вдалося надіслати замовлення. Перевірте інтернет та спробуйте ще раз.');
    }
}

function showOrderError(msg) {
    const el = document.getElementById('ord-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
}

function showOrderSuccess(msg = '✅ Замовлення успішно надіслано!') {
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
        position:fixed; bottom:30px; left:50%; transform:translateX(-50%);
        background:#2d6a2d; color:#fff; padding:14px 28px;
        border-radius:12px; font-size:1rem; font-weight:bold;
        box-shadow:0 4px 16px rgba(0,0,0,0.2); z-index:99999;
        animation: fadeInUp .3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function finalizeOrder() {
    cart = [];
    saveCart();
    updateCartUI();
    closeCart();
}

// ==========================================
// ЗАПУСК ПРИ ЗАВАНТАЖЕННІ СТОРІНКИ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();       // спочатку завантажуємо товари з JSON
    updateCartUI();
    applyFilters();
    injectCardImageStyles();
});

// Стилі для блоку з фото у картці товару
function injectCardImageStyles() {
    if (document.getElementById('card-img-styles')) return;
    const style = document.createElement('style');
    style.id = 'card-img-styles';
    style.textContent = `
        .card-img-wrap {
            width: 100%;
            aspect-ratio: 4 / 3;
            overflow: hidden;
            border-radius: 8px;
            margin-bottom: 10px;
            background: #f4f4f4;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .card-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
            transition: transform 0.2s ease;
        }
        .card:hover .card-img {
            transform: scale(1.04);
        }
        .card-img-placeholder {
            font-size: 2.5rem;
            color: #ccc;
            user-select: none;
        }
    `;
    document.head.appendChild(style);
}
