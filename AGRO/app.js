// ==========================================
// ЗАВАНТАЖЕННЯ ТОВАРІВ З JSON (замість хардкоду)
// ==========================================

const SITE_VERSION = '20260529'; // оновлювати при зміні товарів

let products = [];
let renderedProducts = []; // для модального вікна товару

async function loadProducts() {
    try {
        // img-map кешуємо у sessionStorage — між переходами по категоріях
        let imgs = {};
        const cachedMap = sessionStorage.getItem('agronom_img_map_v3');
        if (cachedMap) {
            imgs = JSON.parse(cachedMap);
        }

        const prodResp = await fetch('products.json?v=' + SITE_VERSION);
        if (!prodResp.ok) throw new Error('products.json: HTTP ' + prodResp.status);
        const prod = await prodResp.json();

        if (!cachedMap) {
            const imgResp = await fetch('img-map.json?v=' + SITE_VERSION);
            if (imgResp.ok) {
                imgs = await imgResp.json();
                try { sessionStorage.setItem('agronom_img_map_v3', JSON.stringify(imgs)); } catch(e) {}
            }
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

const currentPage = window.location.pathname.split("/").pop();

// ==========================================
// НАВІГАЦІЯ — єдине місце, де перелічені всі категорії
// ==========================================

const NAV_ITEMS = [
    { href: 'index.html',                  label: 'Всі товари',           cat: null                },
    { href: 'category.html?cat=chemicals', label: 'АГРОХІМІКАТИ',         cat: 'chemicals'         },
    { href: 'category.html?cat=import',    label: 'НАСІННЯ ІМПОРТНЕ',     cat: 'import'            },
    { href: 'category.html?cat=domestic',  label: 'НАСІННЯ ВІТЧИЗНЯНЕ',   cat: 'domestic'          },
    { href: 'category.html?cat=weight',    label: 'НАСІННЯ ВАГОВЕ',       cat: 'weight'            },
    { href: 'category.html?cat=materials', label: 'МАТЕРІАЛИ',            cat: 'materials'         },
    { href: 'category.html?cat=drops',     label: 'КРАПЕЛЬНЕ ЗРОШУВАННЯ', cat: 'drops'             },
    { href: 'category.html?cat=soil',      label: 'ГРУНТ',                cat: 'soil'              },
    { href: 'category.html?cat=pots',      label: 'ГОРЩИКИ',              cat: 'pots'              },
    { href: 'category.html?cat=insects',   label: 'ПРОТИ КОМАХ',          cat: 'insects'           },
    { href: 'category.html?cat=animals',   label: 'ДЛЯ ТВАРИН',          cat: 'animals'           },
    { href: 'category.html?cat=sprouts',  label: 'РОЗСАДА',              cat: 'sprouts'           },
];

// Малює горизонтальну навігацію з активним станом поточної категорії
function renderMainNav() {
    const container = document.getElementById('main-nav');
    if (!container) return;

    const currentCatKey = new URLSearchParams(location.search).get('cat');
    const isIndex = (currentPage === 'index.html' || currentPage === '');

    container.innerHTML = NAV_ITEMS.map(function (item) {
        var active = (item.cat === null && isIndex) || (item.cat === currentCatKey);
        return '<a href="' + item.href + '" class="cat-btn' + (active ? ' active' : '') + '">' + item.label + '</a>';
    }).join('');
}

// ==========================================
// 1. Визначення категорії: спочатку ?cat=, потім назва файлу (зворотна сумісність)
// ==========================================

const CAT_PARAM_MAP = {
    chemicals: 'АГРОХІМІКАТИ',
    import:    'НАСІННЯ ІМПОРТНЕ',
    domestic:  'НАСІННЯ ВІТЧИЗНЯНЕ',
    insects:   'ПРОТИ КОМАХ',
    weight:    'НАСІННЯ ВАГОВЕ',
    materials: 'МАТЕРІАЛИ',
    drops:     'КРАПЕЛЬНЕ ЗРОШУВАННЯ',
    animals:   'ДЛЯ ТВАРИН',
    soil:      'ГРУНТ',
    pots:      'ГОРЩИКИ',
    sprouts:   'РОЗСАДА',
};

function getInitialCategory() {
    // Пріоритет: параметр ?cat= (category.html)
    const catKey = new URLSearchParams(location.search).get('cat');
    if (catKey && CAT_PARAM_MAP[catKey]) return CAT_PARAM_MAP[catKey];

    // Зворотна сумісність: старі URL типу chemicals.html (якщо файли ще є на сервері)
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

    return "Всі"; // index.html
}

let currentCat = getInitialCategory();

// ==========================================
// РЕЦЕПТИ: СХЕМИ ЗАХИСТУ + ПОШУКОВІ ФІЛЬТРИ
// Оптимізовано: без дублів, сворачиваемий пошук
// ==========================================

let recipes = [];
let searchFiltersExpanded = (localStorage.getItem('searchFiltersExpanded') !== 'false');

async function loadRecipes() {
    try {
        const resp = await fetch('recipes.json?v=' + SITE_VERSION);
        if (!resp.ok) throw new Error('recipes.json: HTTP ' + resp.status);
        recipes = await resp.json();
        renderRecipes();
    } catch(e) {
        console.warn('⚠️ recipes.json не знайдено:', e.message);
    }
}

// Схеми захисту — об'єднані культури (без дублів apple_insects + apple_disease і т.д.)
const SCHEME_LINKS = {
    'apple':       'pomaceous_fruits?scheme=apple_protection',
    'cherry':      'stone_fruits?scheme=cherry_sweet_protection',
    'tomato':      'vegetables?scheme=tomato_greenhouse',
    'cucumber':    'vegetables?scheme=cucumber_protection',
    'pepper':      'vegetables?scheme=pepper_syngenta',
    'cabbage':     'vegetables?scheme=cabbage_protection',
    'carrot':      'vegetables?scheme=carrot_protection',
    'grain_wheat': 'grain_crops?scheme=wheat_spring',
    'grain_corn':  'grain_crops?scheme=corn_protection',
    'grapes':      'grapes?scheme=grapes_full_protection',
};

// Схеми Syngenta — альтернативна кнопка поруч із загальною
const SYNGENTA_LINKS = {
    'apple':       'pomaceous_fruits?scheme=apple_syngenta',
    'cherry':      'stone_fruits?scheme=cherry_syngenta',
    'tomato':      'vegetables?scheme=tomato_syngenta',
    'cucumber':    'vegetables?scheme=cucumber_syngenta',
    'pepper':      'vegetables?scheme=pepper_syngenta',
    'cabbage':     'vegetables?scheme=cabbage_syngenta',
    'carrot':      'vegetables?scheme=carrot_syngenta',
    'grapes':      'grapes?scheme=grapes_syngenta',
};

function renderRecipes() {
    const container = document.getElementById('recipes-container');
    if (!container) return;

    function toHref(target) {
        return 'protection_schemes.html?category=' + target.replace('?scheme=', '&scheme=');
    }
    function schemeBtn(r) {
        return '<a class="recipe-btn scheme" href="' + toHref(SCHEME_LINKS[r.id]) + '">' + r.title + '</a>';
    }
    function synBtn(r) {
        return '<a class="recipe-btn syngenta" href="' + toHref(SYNGENTA_LINKS[r.id]) + '">'
             + r.title + ' <span class="syn-badge">Syngenta</span></a>';
    }
    function searchBtn(r) {
        var kw = (r.keywords && r.keywords[0]) ? r.keywords[0] : r.title;
        kw = kw.replace(/'/g, "\\'");
        return '<button class="recipe-btn search" onclick="quickSearch(\'' + kw + '\')">' + r.title + '</button>';
    }

    // Категорії, де схеми захисту НЕ показуємо (нерелевантно)
    var catKey = new URLSearchParams(location.search).get('cat') || '';
    var hideSchemes = ['drops','soil','pots','animals','materials'].indexOf(catKey) !== -1;

    // Розділяємо за полем type (scheme / search)
    var schemeItems = hideSchemes ? [] : recipes.filter(function(r) { return r.type === 'scheme' && SCHEME_LINKS[r.id]; });
    var searchItems = recipes.filter(function(r) { return r.type === 'search'; });

    // Fallback для старого формату recipes.json (без поля type)
    if (!schemeItems.length && !searchItems.length && !hideSchemes) {
        schemeItems = recipes.filter(function(r) { return SCHEME_LINKS[r.id]; });
        searchItems = recipes.filter(function(r) { return !SCHEME_LINKS[r.id] && !SYNGENTA_LINKS[r.id]; });
    }

    var expanded = searchFiltersExpanded;
    var html = '<div class="recipes-block">';

    // 1️⃣ СХЕМИ ЗАХИСТУ
    if (schemeItems.length) {
        html += '<div class="recipes-section schemes">';
        html += '<div class="recipes-section-title">📋 Схеми захисту та вирощування</div>';
        html += '<div class="recipes-grid">';
        schemeItems.forEach(function(r) {
            html += schemeBtn(r);
            if (SYNGENTA_LINKS[r.id]) html += synBtn(r);
        });
        html += '</div></div>';
    }

    // 2️⃣ ПОШУКОВІ ФІЛЬТРИ (сворачиваемі)
    if (searchItems.length) {
        html += '<div class="recipes-section search">';
        html += '<div class="search-filters-toggle">';
        html += '<input type="checkbox" id="toggle-search-filters"'
             + (expanded ? ' checked' : '')
             + ' onchange="toggleSearchFilters()">';
        html += '<label for="toggle-search-filters">🔍 Пошук товарів (' + searchItems.length + ')</label>';
        html += '</div>';
        html += '<div id="search-filters-container"' + (expanded ? '' : ' class="collapsed"') + '>';
        html += '<div class="recipes-grid search-grid">';
        searchItems.forEach(function(r) { html += searchBtn(r); });
        html += '</div></div></div>';
    }

    html += '</div>';
    container.innerHTML = html;
}

function toggleSearchFilters() {
    var checkbox = document.getElementById('toggle-search-filters');
    var container = document.getElementById('search-filters-container');
    if (!checkbox || !container) return;
    searchFiltersExpanded = checkbox.checked;
    if (searchFiltersExpanded) {
        container.classList.remove('collapsed');
    } else {
        container.classList.add('collapsed');
    }
    localStorage.setItem('searchFiltersExpanded', searchFiltersExpanded);
}

function quickSearch(query) {
    visibleCount = 20; // скидаємо ліміт при новому пошуку
    const searchEl = document.getElementById('search');
    if (searchEl) {
        searchEl.value = query;
        applyFilters();
        setTimeout(function() {
            var grid = document.getElementById('grid');
            if (grid) grid.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
}


// 2. Основна функція фільтрації (Пошук + Категорія + Підкатегорія)
function applyFilters() {
    const searchEl = document.getElementById('search');
    const query = searchEl ? searchEl.value.toLowerCase() : '';

    const filtered = products.filter(p => {
        const matchMainCat = (currentCat === 'Всі' || p.c === currentCat);
        const matchSubCat  = (currentSubCat === 'Всі' || p.b === currentSubCat);
        const searchText = (p.n + ' ' + (p.keywords || '')).toLowerCase();
        const matchSearch = searchText.includes(query);

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

    // Порожній стан
    if (arr.length === 0) {
        grid.innerHTML = `<div style="
            grid-column: 1/-1; text-align:center; padding: 40px 20px;
            color: #888; font-size: 1rem; line-height: 1.6;
        ">
            <div style="font-size:2.5rem; margin-bottom:12px;">🔍</div>
            <div style="font-weight:600; margin-bottom:6px;">Нічого не знайдено</div>
            <div style="font-size:0.9rem;">Спробуйте змінити запит або <a href="#" onclick="clearSearch(event)" style="color:#2d6a2d;">очистити пошук</a></div>
        </div>`;
        const loadMoreBtn = document.getElementById('loadMore');
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
    }

    const slice = arr.slice(0, visibleCount);
    renderedProducts = slice; // зберігаємо для модального вікна

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

    // Збираємо HTML у масив — один innerHTML замість += у циклі
    const cards = slice.map((p, idx) => {
        const safeName = p.n.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const isWeight = p.c === "НАСІННЯ ВАГОВЕ" ||
                 p.n.toLowerCase().includes(", кг") ||
                 p.n.toLowerCase().includes(", 1 кг") ||
                 p.n.toLowerCase().includes(" ваговий") ||
                 p.n.toLowerCase().endsWith(",кг");

        const icon = catIcons[p.c] || '🛒';

        const imgBlock = p.img
            ? `<div class="card-img-wrap" onclick="openProductModal(${idx})">
                   <img src="${p.img}" alt="${p.n}" class="card-img"
                        onerror="this.parentElement.innerHTML='<div class=\\'card-img-placeholder\\'>${icon}</div>'">
               </div>`
            : `<div class="card-img-wrap" onclick="openProductModal(${idx})">
                   <div class="card-img-placeholder">${icon}</div>
               </div>`;

        return `
            <div class="card">
                ${imgBlock}
                <h3>${p.n}</h3>
                <div class="price">${p.p.toFixed(2)} грн ${isWeight ? '<small>/кг</small>' : ''}</div>
                
                ${isWeight ? `
                    <div style="margin: 10px 0; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <button onclick="(function(){var i=document.getElementById('qty-${idx}');var v=Math.round((parseFloat(i.value||0)-0.05)*100)/100;i.value=v<0.05?0.05:v;})()" 
                                style="width:30px;height:36px;border:2px solid #27ae60;background:#e8f5e8;border-radius:6px;font-size:1.1rem;font-weight:bold;cursor:pointer;color:#2d6a2d;line-height:1;padding:0;">&#8722;</button>
                        <input type="number" id="qty-${idx}" 
                               value="0.05" 
                               step="0.05" 
                               min="0.05" 
                               style="width: 68px; padding: 8px 4px; border-radius: 6px; border: 2px solid #27ae60; text-align: center; font-weight: bold;">
                        <button onclick="(function(){var i=document.getElementById('qty-${idx}');i.value=Math.round((parseFloat(i.value||0)+0.05)*100)/100;})()" 
                                style="width:30px;height:36px;border:2px solid #27ae60;background:#e8f5e8;border-radius:6px;font-size:1.1rem;font-weight:bold;cursor:pointer;color:#2d6a2d;line-height:1;padding:0;">+</button>
                        <span style="font-weight: bold; color: #555;">кг</span>
                    </div>
                    <button class="btn" onclick="addWeightToCart('${safeName}', ${p.p}, ${idx}, 'кг')">ДОДАТИ</button>
                ` : `
                    <button class="btn" onclick="addToCart('${safeName}', ${p.p}, this)">ДОДАТИ</button>
                `}
            </div>
        `;
    });

    grid.innerHTML = cards.join('');

    const loadMoreBtn = document.getElementById('loadMore');
    if (loadMoreBtn) loadMoreBtn.style.display = arr.length > visibleCount ? 'block' : 'none';
}

function clearSearch(e) {
    e.preventDefault();
    const searchEl = document.getElementById('search');
    if (searchEl) { searchEl.value = ''; applyFilters(); }
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
    const itemCount = cart.length; // кількість різних позицій
    const totalUnits = cart.reduce((s, i) => s + parseFloat(i.q || 0), 0); // загальна кількість одиниць
    const totalSum   = cart.reduce((sum, item) => sum + (item.p * item.q), 0);

    const countEl  = document.getElementById('cart-count');
    const floatBtn = document.getElementById('cart-float');

    // Плаваюча кнопка: завжди показуємо якщо є товари
    if (floatBtn) {
        floatBtn.style.display = itemCount > 0 ? 'flex' : 'none';
        const unitsLabel = Number.isInteger(totalUnits) ? totalUnits : totalUnits.toFixed(2);
        floatBtn.innerHTML = `🛒 Кошик (${unitsLabel} од.) — ${totalSum.toFixed(2)} грн`;
    }
    if (countEl) countEl.innerText = itemCount;
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

            <div style="display:flex; gap:10px;">
                <button id="ord-submit-btn" onclick="submitOrder('telegram')" style="
                    flex:1; padding:13px; background:#2d6a2d; color:#fff;
                    border:none; border-radius:10px; font-size:1rem;
                    font-weight:bold; cursor:pointer; transition:background .2s;
                ">
                    ✅ Оформити замовлення
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

    if (!name)  return showOrderError("Введіть ваше Прізвище та Ім'я");
    if (!phone) return showOrderError('Введіть номер телефону');

    // Валідація формату телефону (UA/RU/міжнародний)
    const phoneClean = phone.replace(/[\s\-\(\)]/g, '');
    if (!/^(\+?380|0)\d{9}$/.test(phoneClean)) {
        return showOrderError('Номер телефону у форматі +380XXXXXXXXX або 0XXXXXXXXX');
    }

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

        const openViber = () => {
            window.location.href = viberUrl;
            setTimeout(() => {
                if (document.hasFocus()) window.open(viberWebUrl, '_blank');
            }, 1200);
            closeOrderModal();
            finalizeOrder();
        };

        const showViberCopyFallback = () => {
            // Clipboard недоступний — показуємо текст для ручного копіювання
            closeOrderModal();
            const fb = document.createElement('div');
            fb.id = 'viber-fallback';
            fb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;box-sizing:border-box;';
            fb.innerHTML = `<div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:440px;box-sizing:border-box;">
                <h3 style="margin:0 0 12px;font-size:1rem;color:#1a2e1a;">📋 Скопіюйте текст і надішліть у Viber</h3>
                <textarea readonly rows="10" style="width:100%;padding:10px;border:1.5px solid #ccc;border-radius:8px;font-size:0.8rem;resize:none;box-sizing:border-box;">${plainMessage}</textarea>
                <div style="display:flex;gap:10px;margin-top:12px;">
                    <button onclick="navigator.clipboard&&navigator.clipboard.writeText(this.parentElement.previousElementSibling.value).then(()=>{this.textContent='✓ Скопійовано!'})" 
                        style="flex:1;padding:11px;background:#2d6a2d;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">📋 Копіювати</button>
                    <button onclick="window.location.href='${viberUrl}'" 
                        style="flex:1;padding:11px;background:#7360f2;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">📲 Відкрити Viber</button>
                    <button onclick="document.getElementById('viber-fallback').remove()" 
                        style="padding:11px 14px;background:#eee;border:none;border-radius:8px;cursor:pointer;">✕</button>
                </div>
            </div>`;
            document.body.appendChild(fb);
            finalizeOrder();
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(plainMessage)
                .then(() => {
                    openViber();
                    showOrderSuccess('📲 Текст скопійовано — вставте у Viber і надішліть!');
                })
                .catch(showViberCopyFallback);
        } else {
            showViberCopyFallback();
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
            throw new Error('Помилка надсилання');
        }
    } catch (err) {
        console.error('Order send error:', err);
        btn.disabled = false;
        btn.textContent = '✅ Оформити замовлення';
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
    renderMainNav();            // навігація з активним станом
    await loadProducts();       // товари з JSON
    await loadRecipes();
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
            cursor: pointer;
            position: relative;
        }
        .card-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
            transition: transform 0.3s ease;
        }
        .card-img-wrap:hover .card-img {
            transform: scale(1.08);
        }
        .card-img-placeholder {
            font-size: 2.5rem;
            color: #ccc;
            user-select: none;
        }
        /* Підказка "🔍" при наведенні */
        .card-img-wrap::after {
            content: '🔍';
            position: absolute;
            bottom: 6px;
            right: 8px;
            font-size: 1.1rem;
            opacity: 0;
            transition: opacity 0.25s;
            pointer-events: none;
        }
        .card-img-wrap:hover::after {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);
}

// ==========================================
// МОДАЛЬНЕ ВІКНО ТОВАРУ (фото + анотація)
// ==========================================

function openProductModal(idx) {
    const p = renderedProducts[idx];
    if (!p) return;

    const old = document.getElementById('product-modal');
    if (old) old.remove();

    const isWeight = p.c === "НАСІННЯ ВАГОВЕ" ||
        p.n.toLowerCase().includes(", кг") ||
        p.n.toLowerCase().includes(", 1 кг") ||
        p.n.toLowerCase().includes(" ваговий") ||
        p.n.toLowerCase().endsWith(",кг");

    const modal = document.createElement('div');
    modal.id = 'product-modal';
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.75);
        display:flex; align-items:center; justify-content:center;
        z-index:10000; padding:16px; box-sizing:border-box;
    `;

    const imgHtml = p.img
        ? `<img src="${p.img}" alt=""
               style="width:100%; max-height:280px; object-fit:contain;
                      border-radius:10px; margin-bottom:16px; display:block;">`
        : '';

    const annotHtml = p.annot
        ? `<p style="font-size:.95rem; color:#444; line-height:1.6; margin:0 0 16px;">${p.annot}</p>`
        : '';

    const qtyHtml = isWeight ? `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <span style="font-size:.9rem; color:#555; white-space:nowrap;">Кількість:</span>
            <input id="modal-qty" type="number" value="0.05" step="0.05" min="0.05"
                style="width:90px; padding:8px 10px; border:2px solid #27ae60;
                       border-radius:8px; font-size:1rem; font-weight:bold; text-align:center;">
            <span style="font-size:.9rem; color:#555;">кг</span>
        </div>
    ` : `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <span style="font-size:.9rem; color:#555; white-space:nowrap;">Кількість:</span>
            <input id="modal-qty" type="number" value="1" step="1" min="1"
                style="width:90px; padding:8px 10px; border:2px solid #27ae60;
                       border-radius:8px; font-size:1rem; font-weight:bold; text-align:center;">
            <span style="font-size:.9rem; color:#555;">шт.</span>
        </div>
    `;

    modal.innerHTML = `
        <div style="
            background:#fff; border-radius:16px; padding:24px;
            width:100%; max-width:480px; max-height:90vh;
            overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.3);
            position:relative; box-sizing:border-box;
        ">
            <button onclick="closeProductModal()" style="
                position:absolute; top:12px; right:14px;
                background:none; border:none; font-size:1.6rem;
                cursor:pointer; color:#888; line-height:1;
            ">✕</button>

            <h3 style="margin:0 0 4px; padding-right:28px; font-size:1rem;
                       color:#1a2e1a; line-height:1.4;">${p.n}</h3>

            <div style="font-size:1.2rem; font-weight:bold; color:#27ae60; margin-bottom:14px;">
                ${p.p.toFixed(2)} грн${isWeight ? ' / кг' : ''}
            </div>

            ${imgHtml}
            ${annotHtml}
            ${qtyHtml}

            <div style="display:flex; gap:10px;">
                <button id="modal-add-btn" onclick="addToCartFromModal(${idx})" style="
                    flex:1; padding:13px; background:#2d6a2d; color:#fff;
                    border:none; border-radius:10px; font-size:1rem;
                    font-weight:bold; cursor:pointer;
                ">🛒 Додати в кошик</button>

                <button onclick="closeProductModal()" style="
                    padding:13px 18px; background:#f0f0f0; color:#555;
                    border:none; border-radius:10px; font-size:1rem;
                    font-weight:bold; cursor:pointer;
                ">Закрити</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeProductModal(); });
}

function addToCartFromModal(idx) {
    const p = renderedProducts[idx];
    if (!p) return;

    const qtyInput = document.getElementById('modal-qty');
    const quantity = parseFloat(qtyInput.value);

    if (isNaN(quantity) || quantity <= 0) {
        alert('Вкажіть коректну кількість');
        return;
    }

    const item = cart.find(i => i.n === p.n);
    if (item) {
        item.q = parseFloat((item.q + quantity).toFixed(3));
    } else {
        cart.push({ n: p.n, p: p.p, q: quantity });
    }
    saveCart();

    const btn = document.getElementById('modal-add-btn');
    if (btn) {
        btn.textContent = '✓ Додано!';
        btn.style.background = '#1a2e1a';
        setTimeout(() => {
            btn.textContent = '🛒 Додати в кошик';
            btn.style.background = '#2d6a2d';
        }, 1000);
    }
}

function closeProductModal() {
    const m = document.getElementById('product-modal');
    if (m) m.remove();
}
