// ==========================================
// СЕЗОННИЙ ПОМІЧНИК — "Що зараз робити?"
// Підключати після app.js: <script src="seasonal-helper.js"></script>
// Рендерить блок у <div id="seasonal-helper-container">
// ==========================================

(function () {
    'use strict';

    // ── Мапа культур ──────────────────────────────────────────────
    // id — збігається з SCHEME_LINKS у app.js та стадіями в protection_schemes.json
    const CULTURES = [
        { id: 'apple',       label: '🍎 Яблуня',    schemeCategory: 'pomaceous_fruits', schemeId: 'apple_protection'  },
        { id: 'pear',        label: '🍐 Груша',      schemeCategory: 'pomaceous_fruits', schemeId: 'pear_protection'   },
        { id: 'cherry',      label: '🍒 Черешня',    schemeCategory: 'stone_fruits',     schemeId: 'cherry_sweet_protection' },
        { id: 'grapes',      label: '🍇 Виноград',   schemeCategory: 'grapes',           schemeId: 'grapes_full_protection' },
        { id: 'tomato',      label: '🍅 Томати',     schemeCategory: 'vegetables',       schemeId: 'tomato_greenhouse' },
        { id: 'cucumber',    label: '🥒 Огірки',     schemeCategory: 'vegetables',       schemeId: 'cucumber_protection' },
        { id: 'grain_wheat', label: '🌾 Пшениця',   schemeCategory: 'grain_crops',      schemeId: 'wheat_spring'      },
        { id: 'grain_corn',  label: '🌽 Кукурудза', schemeCategory: 'grain_crops',      schemeId: 'corn_protection'   },
    ];

    // ── Місячна прив'язка стадій ──────────────────────────────────
    // Для кожної культури: { місяць(0-11) → індекс стадії у схемі }
    // Місяці без активної стадії — null (не сезон)
    const MONTH_TO_STAGE = {
        apple_protection: {
            2: 0,  // Березень  → стадія 1 (рання весна)
            3: 1,  // Квітень   → стадія 2 (рожевий бутон)
            4: 3,  // Травень   → стадія 4 (після цвітіння) — стадія 3 "не обробляти"
            5: 4,  // Червень   → стадія 5 (літо 1)
            6: 5,  // Липень    → стадія 6 (літо 2)
            7: 6,  // Серпень   → стадія 7 (перед збором)
            8: 6,  // Вересень  → стадія 7
            9: 7,  // Жовтень   → стадія 8 (після збору)
        },
        pear_protection: {
            2: 0, 3: 1, 4: 3, 5: 4, 6: 5, 7: 6, 8: 6, 9: 7,
        },
        cherry_sweet_protection: {
            2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 5, 9: 6,
        },
        grapes_full_protection: {
            3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6,
        },
        tomato_greenhouse: {
            2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 5,
        },
        cucumber_protection: {
            2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 4,
        },
        wheat_spring: {
            2: 0, 3: 1, 4: 2, 5: 3,
        },
        corn_protection: {
            3: 0, 4: 1, 5: 2, 6: 3, 7: 4,
        },
    };

    // ── CSS ───────────────────────────────────────────────────────
    const CSS = `
    #seasonal-helper-container {
        margin-bottom: 20px;
    }
    .sh-block {
        background: linear-gradient(135deg, #e8f5e8 0%, #f0faf0 100%);
        border-radius: 14px;
        padding: 18px 18px 16px;
        border: 1.5px solid #c5e0c5;
    }
    .sh-title {
        font-family: 'Nunito', sans-serif;
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #2d6a2d;
        margin-bottom: 12px;
    }
    .sh-cultures {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 14px;
    }
    .sh-culture-btn {
        background: white;
        border: 1.5px solid #c8e0c8;
        color: #2d6a2d;
        padding: 7px 14px;
        border-radius: 20px;
        cursor: pointer;
        font-family: 'Nunito', sans-serif;
        font-weight: 600;
        font-size: 0.85rem;
        transition: all 0.18s;
        white-space: nowrap;
    }
    .sh-culture-btn:hover {
        background: #d8efd8;
        border-color: #4a9c4a;
    }
    .sh-culture-btn.active {
        background: #2d6a2d;
        color: white;
        border-color: #2d6a2d;
    }

    /* Результат */
    .sh-result {
        background: white;
        border-radius: 10px;
        padding: 16px;
        border: 1.5px solid #b8d8b8;
        animation: sh-fadein 0.25s ease;
    }
    @keyframes sh-fadein {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0);   }
    }
    .sh-stage-label {
        font-size: 1rem;
        font-weight: 700;
        color: #1a3a1a;
        margin-bottom: 4px;
        line-height: 1.3;
    }
    .sh-date-badge {
        display: inline-block;
        background: #e8f5e8;
        color: #2d6a2d;
        border-radius: 8px;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 2px 10px;
        margin-bottom: 10px;
    }
    .sh-problem {
        font-size: 0.85rem;
        color: #c0392b;
        background: #fff5f5;
        border-left: 3px solid #e74c3c;
        padding: 6px 10px;
        border-radius: 0 6px 6px 0;
        margin-bottom: 12px;
        line-height: 1.4;
    }
    .sh-warning {
        font-size: 0.85rem;
        color: #e07b00;
        background: #fff9f0;
        border-left: 3px solid #e07b00;
        padding: 8px 12px;
        border-radius: 0 6px 6px 0;
        margin-bottom: 10px;
        font-weight: 600;
    }
    .sh-products-label {
        font-size: 0.78rem;
        font-weight: 700;
        color: #555;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 8px;
    }
    .sh-products-list {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-bottom: 14px;
    }
    .sh-product-chip {
        background: #f0f8f0;
        border: 1.5px solid #b0d4b0;
        color: #1a3a1a;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
        font-family: 'Nunito', sans-serif;
        position: relative;
    }
    .sh-product-chip:hover {
        background: #2d6a2d;
        color: white;
        border-color: #2d6a2d;
    }
    .sh-product-chip.added {
        background: #1a3a1a;
        color: white;
        border-color: #1a3a1a;
    }
    .sh-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }
    .sh-btn-addall {
        flex: 1;
        min-width: 160px;
        background: #2d6a2d;
        color: white;
        border: none;
        padding: 11px 16px;
        border-radius: 9px;
        font-family: 'Nunito', sans-serif;
        font-weight: 700;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background 0.2s;
        text-align: center;
    }
    .sh-btn-addall:hover { background: #1e4620; }
    .sh-btn-addall.done  { background: #1a3a1a; }
    .sh-btn-scheme {
        background: white;
        color: #2d6a2d;
        border: 1.5px solid #2d6a2d;
        padding: 11px 16px;
        border-radius: 9px;
        font-family: 'Nunito', sans-serif;
        font-weight: 700;
        font-size: 0.9rem;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        transition: all 0.18s;
        white-space: nowrap;
    }
    .sh-btn-scheme:hover {
        background: #e8f5e8;
    }
    .sh-offseason {
        color: #888;
        font-size: 0.9rem;
        font-style: italic;
        padding: 8px 0 4px;
    }

    @media (max-width: 480px) {
        .sh-block { padding: 14px 14px 12px; }
        .sh-culture-btn { font-size: 0.8rem; padding: 6px 11px; }
        .sh-btn-addall, .sh-btn-scheme { font-size: 0.82rem; padding: 10px 12px; }
    }
    `;

    // ── Стан ──────────────────────────────────────────────────────
    const STORAGE_KEY = 'sh_selected_culture';
    let selectedCultureId = localStorage.getItem(STORAGE_KEY) || 'apple';
    let schemesData = null;  // заповнюється після завантаження

    // ── Завантаження schemes ──────────────────────────────────────
    async function loadSchemes() {
        if (schemesData) return schemesData;
        try {
            const v = (typeof SITE_VERSION !== 'undefined') ? SITE_VERSION : Date.now();
            const resp = await fetch('protection_schemes.json?v=' + v);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            schemesData = await resp.json();
        } catch (e) {
            console.warn('seasonal-helper: не вдалось завантажити protection_schemes.json', e);
        }
        return schemesData;
    }

    // ── Знайти поточну стадію ─────────────────────────────────────
    function getCurrentStage(culture) {
        const month = new Date().getMonth(); // 0=Jan
        const stageMap = MONTH_TO_STAGE[culture.schemeId];
        if (!stageMap) return null;

        const stageIdx = stageMap[month];
        if (stageIdx === undefined) return null; // не сезон

        if (!schemesData) return null;
        const cat = schemesData.protection_schemes[culture.schemeCategory];
        if (!cat) return null;
        const scheme = cat.schemes.find(function (s) { return s.id === culture.schemeId; });
        if (!scheme) return null;
        return scheme.treatments[stageIdx] || null;
    }

    // ── Знайти товар у глобальному масиві products ────────────────
    function findProduct(name) {
        if (typeof products === 'undefined' || !products.length) return null;
        const kw = name.toLowerCase();
        return products.find(function (p) {
            return p.n.toLowerCase().includes(kw) &&
                   (p.c || '').toLowerCase().includes('агрохімік') &&
                   p.inStock !== false;
        }) || null;
    }

    // ── Додати один товар у кошик ─────────────────────────────────
    function addToCart(name, price) {
        const CART_KEY = 'agronom_cart';
        let cartArr;
        try { cartArr = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { cartArr = []; }
        const item = cartArr.find(function (i) { return i.n === name; });
        if (item) { item.q++; } else { cartArr.push({ n: name, p: price, q: 1 }); }
        localStorage.setItem(CART_KEY, JSON.stringify(cartArr));

        // Синхронізуємо з глобальним кошиком app.js якщо він є
        if (typeof cart !== 'undefined') {
            const gItem = cart.find(function (i) { return i.n === name; });
            if (gItem) { gItem.q++; } else { cart.push({ n: name, p: price, q: 1 }); }
        }
        if (typeof updateCartUI === 'function') updateCartUI();

        // Оновити лічильник плаваючої кнопки
        try {
            const total = (JSON.parse(localStorage.getItem(CART_KEY)) || [])
                .reduce(function (s, i) { return s + (i.q || 0); }, 0);
            const countEl = document.getElementById('cart-count');
            const fltEl   = document.getElementById('cart-float');
            if (countEl) countEl.textContent = total;
            if (fltEl)   fltEl.style.display = total > 0 ? 'block' : 'none';
        } catch (e) {}
    }

    // ── Рендер ────────────────────────────────────────────────────
    function render() {
        const container = document.getElementById('seasonal-helper-container');
        if (!container) return;

        const month = new Date().getMonth();
        const MONTH_NAMES = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                             'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

        const culture = CULTURES.find(function (c) { return c.id === selectedCultureId; }) || CULTURES[0];
        const stage   = getCurrentStage(culture);

        // Кнопки культур
        const culturesHtml = CULTURES.map(function (c) {
            const active = c.id === selectedCultureId ? ' active' : '';
            return '<button class="sh-culture-btn' + active + '" onclick="shSelectCulture(\'' + c.id + '\')">'
                 + c.label + '</button>';
        }).join('');

        // Результат
        let resultHtml = '';
        if (!stage) {
            resultHtml = '<div class="sh-result">'
                + '<div class="sh-offseason">😴 Для ' + culture.label + ' у ' + MONTH_NAMES[month]
                + ' активних обробок немає. Спочиваємо!</div>'
                + '</div>';
        } else {
            // Попередження про цвітіння
            const isWarning = stage.stage && stage.stage.toLowerCase().includes('не обробляти');
            if (isWarning) {
                resultHtml = '<div class="sh-result">'
                    + '<div class="sh-stage-label">' + stage.stage + '</div>'
                    + '<div class="sh-date-badge">📅 ' + (stage.date || MONTH_NAMES[month]) + '</div>'
                    + '<div class="sh-warning">⛔ ' + stage.problem + '</div>'
                    + '<a class="sh-btn-scheme" href="protection_schemes.html?category='
                    + culture.schemeCategory + '&scheme=' + culture.schemeId + '">📋 Повна схема</a>'
                    + '</div>';
            } else {
                // Знаходимо реальні товари (перші 4 зі списку products схеми)
                const topNames = (stage.products || []).slice(0, 4);
                const found = topNames.map(function (name) {
                    return { name: name, product: findProduct(name) };
                });

                const chipsHtml = found.map(function (item, idx) {
                    if (!item.product) {
                        return '<span class="sh-product-chip" style="opacity:.55;cursor:default;">'
                             + item.name + '</span>';
                    }
                    const price = item.product.p || 0;
                    const safeName = item.product.n.replace(/'/g, "\\'");
                    return '<button class="sh-product-chip" id="sh-chip-' + idx + '" '
                         + 'onclick="shAddChip(' + idx + ',\'' + safeName + '\',' + price + ')">'
                         + item.name + '</button>';
                }).join('');

                const schemeHref = 'protection_schemes.html?category=' + culture.schemeCategory
                                 + '&scheme=' + culture.schemeId;

                resultHtml = '<div class="sh-result">'
                    + '<div class="sh-stage-label">' + stage.stage + '</div>'
                    + '<div class="sh-date-badge">📅 ' + (stage.date || MONTH_NAMES[month]) + '</div>'
                    + '<div class="sh-problem">🚨 ' + stage.problem + '</div>'
                    + '<div class="sh-products-label">Рекомендовані препарати:</div>'
                    + '<div class="sh-products-list" id="sh-chips">' + chipsHtml + '</div>'
                    + '<div class="sh-actions">'
                    + '<button class="sh-btn-addall" id="sh-addall-btn" onclick="shAddAll()">'
                    + '🛒 Додати всі в кошик</button>'
                    + '<a class="sh-btn-scheme" href="' + schemeHref + '">📋 Повна схема</a>'
                    + '</div>'
                    + '</div>';
            }
        }

        container.innerHTML =
            '<div class="sh-block">'
            + '<div class="sh-title">🌿 Що зараз робити? · ' + MONTH_NAMES[month] + '</div>'
            + '<div class="sh-cultures">' + culturesHtml + '</div>'
            + resultHtml
            + '</div>';
    }

    // ── Глобальні хендлери (викликаються з inline onclick) ────────
    window.shSelectCulture = function (id) {
        selectedCultureId = id;
        localStorage.setItem(STORAGE_KEY, id);
        render();
    };

    window.shAddChip = function (idx, name, price) {
        addToCart(name, price);
        const chip = document.getElementById('sh-chip-' + idx);
        if (chip) {
            chip.classList.add('added');
            chip.textContent = '✓ ' + chip.textContent.replace(/^✓ /, '');
        }
    };

    window.shAddAll = function () {
        const btn = document.getElementById('sh-addall-btn');
        const chips = document.querySelectorAll('#sh-chips .sh-product-chip[id]');
        let added = 0;
        chips.forEach(function (chip, idx) {
            // дістаємо name і price з onclick атрибуту
            const match = chip.getAttribute('onclick').match(/shAddChip\(\d+,'(.+?)',(\d+(?:\.\d+)?)\)/);
            if (match) {
                addToCart(match[1], parseFloat(match[2]));
                chip.classList.add('added');
                chip.textContent = '✓ ' + chip.textContent.replace(/^✓ /, '');
                added++;
            }
        });
        if (btn && added > 0) {
            btn.textContent = '✓ Додано ' + added + ' товари';
            btn.classList.add('done');
        }
    };

    // ── Ін'єкція стилів ───────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('sh-styles')) return;
        const style = document.createElement('style');
        style.id = 'sh-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    // ── Ініціалізація ─────────────────────────────────────────────
    async function init() {
        injectStyles();
        // Показуємо скелетон поки вантажимо
        const container = document.getElementById('seasonal-helper-container');
        if (!container) return;

        await loadSchemes();
        render();
    }

    // Запускаємо після того як app.js завантажив products
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            // Чекаємо трохи щоб app.js встиг відпрацювати loadProducts()
            setTimeout(init, 300);
        });
    } else {
        setTimeout(init, 300);
    }

})();
