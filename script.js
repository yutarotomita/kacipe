class RecipeApp {
    constructor() {
        this.appsScriptUrl = 'https://script.google.com/macros/s/AKfycbxCEcOrKlgVeFoE7R3cviHrwp1UB6Q8un87p2OkzToSc1NMT6gy6NKaI2YHI3Pe_VA/exec';
        
        this.db = {
            ingredients: [], ingredientPrices: [],
            recipes: [], recipeIngredients: [],
            products: [], productRecipes: [], productPrices: [],
            productIngredients: []
        };
        this.selectedProductId = null;
        this.isSimulationMode = false;
        this.simulationPrices = {
            product: null,
            ingredients: {}
        };
        this.aiKey = '';
        this.ALLERGENS = ['えび', 'かに', 'くるみ', '小麦', 'そば', '卵', '乳', '落花生(ピーナッツ)', 'アーモンド', 'あわび', 'いか', 'いくら', 'オレンジ', 'カシューナッツ', 'キウイフルーツ', '牛肉', 'ごま', 'さけ', 'さば', '大豆', '鶏肉', 'バナナ', '豚肉', 'まつたけ', 'もも', 'やまいも', 'りんご', 'ゼラチン'];
        this.UNITS = ['g', 'ml', '個', '枚', '本'];
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    callApi(action, payload = {}) {
        return fetch(this.appsScriptUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: action, payload: payload })
        }).then(response => {
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        });
    }

    handleServerResponse(data) {
        console.log("Parsed data from server:", data);
        if (data.error) {
             alert('サーバーでエラーが発生しました: ' + data.error);
             return false;
        }
        if (data && typeof data === 'object' && 'ingredients' in data && 'products' in data) {
            this.db = data;
            this.renderAll();
            return true;
        }
        alert('データの形式が正しくありません。スプレッドシートのシート名やヘッダーが「設定ガイド」通りか確認してください。');
        return false;
    }

    init() {
        this.showLoader('データを読み込んでいます...');
        this.loadAiKey();
        this.setupEventListeners();
        
        this.callApi('getAllData')
            .then(data => {
                if (this.handleServerResponse(data)) {
                    this.showTab('dashboard');
                }
                this.hideLoader();
            })
            .catch(err => {
                alert('データの読み込みに失敗しました: ' + err.message);
                this.hideLoader();
            });
    }

    handleSaveIngredient() {
        if (!document.getElementById('ingredient-form').reportValidity()) return;
        const selectedAllergens = Array.from(document.querySelectorAll('.ingredient-allergen:checked')).map(cb => cb.value);
        const ingredientData = { id: document.getElementById('ingredientId').value, name: document.getElementById('ingredientName').value, subIngredients: document.getElementById('ingredientSubIngredients').value, calories: document.getElementById('ingredientCalories').value, protein: document.getElementById('ingredientProtein').value, fat: document.getElementById('ingredientFat').value, carbs: document.getElementById('ingredientCarbs').value, salt: document.getElementById('ingredientSalt').value, allergens: selectedAllergens, url: document.getElementById('ingredientUrl').value, };
        const prices = [];
        document.querySelectorAll('#ingredient-prices-container .price-row').forEach(row => { const priceData = { price: row.querySelector('.price-price').value, unitAmount: row.querySelector('.price-unit-amount').value, unitType: row.querySelector('.price-unit-type').value, gramEquivalent: row.querySelector('.price-gram-equivalent').value, startDate: row.querySelector('.price-start-date').value, }; if (priceData.price && priceData.unitAmount && priceData.startDate) { prices.push(priceData); } });
        
        const isNew = !ingredientData.id;
        const tempId = 'temp-' + Date.now();
        if(isNew) ingredientData.id = tempId;

        const index = this.db.ingredients.findIndex(i => i.id === ingredientData.id);
        if(index > -1) { this.db.ingredients[index] = ingredientData; } else { this.db.ingredients.push(ingredientData); }
        this.db.ingredientPrices = this.db.ingredientPrices.filter(p => p.ingredientId !== ingredientData.id);
        prices.forEach(p => { p.ingredientId = ingredientData.id; this.db.ingredientPrices.push(p); });
        this.renderAll();
        this.closeModal();
        this.showLoader('保存中...');
        
        const payload = { ingredient: ingredientData, prices: prices };
        this.callApi('saveIngredient', payload)
            .then(response => {
                this.hideLoader();
                if (response.success && isNew) {
                     const ing = this.db.ingredients.find(i => i.id === tempId);
                     if(ing) ing.id = response.newId;
                     this.db.ingredientPrices.forEach(p => { if(p.ingredientId === tempId) p.ingredientId = response.newId; });
                     this.renderAll();
                }
            })
            .catch(err => {
                this.hideLoader();
                alert('保存に失敗しました。画面をリロードしてデータを確認してください。\nエラー: ' + err.message);
                this.init();
            });
    }

    handleSaveRecipe() {
        if (!document.getElementById('recipe-form').reportValidity()) return;
        const recipeData = { id: document.getElementById('recipeId').value, name: document.getElementById('recipeName').value, yield: document.getElementById('recipeYield').value, time: document.getElementById('recipeTime').value, instructions: document.getElementById('recipeInstructions').value, };
        const recipeIngredients = [];
        document.querySelectorAll('.recipe-ingredient-row').forEach(row => { const riData = { ingredientId: row.querySelector('.recipe-ingredient-id').value, quantity: row.querySelector('.recipe-ingredient-quantity').value, unitType: row.querySelector('.recipe-ingredient-unit-type').value, }; if (riData.ingredientId && riData.quantity) { recipeIngredients.push(riData); } });
        
        const isNew = !recipeData.id;
        const tempId = 'temp-' + Date.now();
        if(isNew) recipeData.id = tempId;

        const index = this.db.recipes.findIndex(r => r.id === recipeData.id);
        if(index > -1) { this.db.recipes[index] = recipeData; } else { this.db.recipes.push(recipeData); }
        this.db.recipeIngredients = this.db.recipeIngredients.filter(ri => ri.recipeId !== recipeData.id);
        recipeIngredients.forEach(ri => { ri.recipeId = recipeData.id; this.db.recipeIngredients.push(ri); });
        this.renderAll();
        this.closeModal();
        this.showLoader('保存中...');
        
        const payload = { recipe: recipeData, ingredients: recipeIngredients };
        this.callApi('saveRecipe', payload)
            .then(response => {
                this.hideLoader();
                 if (response.success && isNew) {
                     const recipe = this.db.recipes.find(r => r.id === tempId);
                     if(recipe) recipe.id = response.newId;
                     this.db.recipeIngredients.forEach(ri => { if(ri.recipeId === tempId) ri.recipeId = response.newId; });
                     this.renderAll();
                }
            })
            .catch(err => {
                this.hideLoader();
                alert('保存に失敗しました: ' + err.message);
                this.init();
            });
    }

    handleSaveProduct() {
        if (!document.getElementById('product-form').reportValidity()) return;
        const productData = { id: document.getElementById('productId').value, name: document.getElementById('productName').value, packagingCost: document.getElementById('productPackagingCost').value, };
        const productRecipes = [];
        document.querySelectorAll('.product-recipe-checkbox').forEach(checkbox => { if(checkbox.checked) { const quantity = checkbox.closest('div.border').querySelector('.product-recipe-quantity').value; if (quantity > 0) { productRecipes.push({ recipeId: checkbox.value, quantity: Number(quantity) }); } } });
        const productIngredients = [];
        document.querySelectorAll('.product-ingredient-row').forEach(row => { const piData = { ingredientId: row.querySelector('.product-ingredient-id').value, quantity: row.querySelector('.product-ingredient-quantity').value, unitType: row.querySelector('.product-ingredient-unit-type').value, }; if (piData.ingredientId && piData.quantity) { productIngredients.push(piData); } });
        const productPrices = [];
        document.querySelectorAll('.product-price-row').forEach(row => { const priceData = { price: row.querySelector('.product-price-price').value, startDate: row.querySelector('.product-price-start-date').value }; if(priceData.price && priceData.startDate) { productPrices.push(priceData); } });
        
        const isNew = !productData.id;
        const tempId = 'temp-' + Date.now();
        if(isNew) productData.id = tempId;

        const index = this.db.products.findIndex(p => p.id === productData.id);
        if(index > -1) { this.db.products[index] = productData; } else { this.db.products.push(productData); }
        this.db.productRecipes = this.db.productRecipes.filter(pr => pr.productId !== productData.id);
        productRecipes.forEach(pr => { pr.productId = productData.id; this.db.productRecipes.push(pr); });
        this.db.productIngredients = this.db.productIngredients.filter(pi => pi.productId !== productData.id);
        productIngredients.forEach(pi => { pi.productId = productData.id; this.db.productIngredients.push(pi); });
        this.db.productPrices = this.db.productPrices.filter(pp => pp.productId !== productData.id);
        productPrices.forEach(pp => { pp.productId = productData.id; this.db.productPrices.push(pp); });
        this.renderAll();
        this.closeModal();
        this.showLoader('保存中...');
        
        const payload = { product: productData, recipes: productRecipes, productIngredients: productIngredients, prices: productPrices };
        this.callApi('saveProduct', payload)
            .then(response => {
                this.hideLoader();
                if (response.success && isNew) {
                    const product = this.db.products.find(p => p.id === tempId);
                    if(product) product.id = response.newId;
                    this.db.productRecipes.forEach(pr => { if(pr.productId === tempId) pr.productId = response.newId; });
                    this.db.productIngredients.forEach(pi => { if(pi.productId === tempId) pi.productId = response.newId; });
                    this.db.productPrices.forEach(pp => { if(pp.productId === tempId) pp.productId = response.newId; });
                    this.renderAll();
                }
            })
            .catch(err => {
                this.hideLoader();
                alert('保存に失敗しました: ' + err.message);
                this.init();
            });
    }
    
    confirmDelete(type, id) {
        const itemName = this.db[type].find(i => i.id === id)?.name || 'この項目';
        const title = '削除の確認';
        const content = `<p>「${itemName}」を本当に削除しますか？<br>関連するデータもすべて削除され、この操作は元に戻せません。</p>`;
        const footer = `<button onclick="app.closeModal()" class="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300 transition mr-2">キャンセル</button><button id="confirm-delete-btn" class="bg-red-600 text-white font-bold py-2 px-4 rounded-md hover:bg-red-700 transition">削除</button>`;
        this.renderModal(title, content, footer);
        document.getElementById('confirm-delete-btn').onclick = () => {
            this.closeModal();
            this.showLoader('削除中...');

            const oldDb = JSON.parse(JSON.stringify(this.db));
            this.db[type] = this.db[type].filter(item => item.id !== id);
            if (type === 'ingredients') { this.db.ingredientPrices = this.db.ingredientPrices.filter(p => p.ingredientId !== id); this.db.recipeIngredients = this.db.recipeIngredients.filter(ri => ri.ingredientId !== id); this.db.productIngredients = this.db.productIngredients.filter(pi => pi.ingredientId !== id); }
            if (type === 'recipes') { this.db.recipeIngredients = this.db.recipeIngredients.filter(ri => ri.recipeId !== id); this.db.productRecipes = this.db.productRecipes.filter(pr => pr.recipeId !== id); }
            if (type === 'products') { this.db.productRecipes = this.db.productRecipes.filter(pr => pr.productId !== id); this.db.productIngredients = this.db.productIngredients.filter(pi => pi.productId !== id); this.db.productPrices = this.db.productPrices.filter(pp => pp.productId !== id); }
            if(type === 'products' && id === this.selectedProductId) { this.selectedProductId = null; document.getElementById('analysis-result').classList.add('hidden'); document.getElementById('analysis-placeholder').classList.remove('hidden'); }
            this.renderAll();
            
            this.callApi('deleteItem', { type, id })
                .then(response => { this.hideLoader(); })
                .catch(err => {
                    this.hideLoader();
                    alert('削除に失敗しました。データを元に戻します。\nエラー: ' + err.message);
                    this.db = oldDb;
                    this.renderAll();
                });
        };
    }
    
    showLoader(text = '処理中...') { document.getElementById('loader-text').textContent = text; document.getElementById('loader-container').classList.add('active'); }
    hideLoader() { document.getElementById('loader-container').classList.remove('active'); }
    
    setupEventListeners() {
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettingsModal());
        document.getElementById('tab-nav').addEventListener('click', (e) => { if (e.target.matches('button')) this.showTab(e.target.dataset.tab); });
        document.getElementById('add-ingredient-btn').addEventListener('click', () => this.openIngredientModal());
        document.getElementById('add-recipe-btn').addEventListener('click', () => this.openRecipeModal());
        document.getElementById('add-product-btn').addEventListener('click', () => this.openProductModal());
        document.getElementById('analysis-product-list').addEventListener('click', e => { if (e.target.closest('.product-button')) { this.selectedProductId = e.target.closest('.product-button').dataset.id; this.renderAnalysisProductList(); this.runAnalysis(); } });
        document.getElementById('analysis-date').addEventListener('change', () => this.runAnalysis());
        document.getElementById('simulation-mode-toggle').addEventListener('change', () => this.toggleSimulationMode());
        
        const dashboardContent = document.getElementById('dashboard-content');
        dashboardContent.addEventListener('click', e => {
             if (e.target.id === 'save-simulation-btn') this.openSaveSimulationModal();
             if (e.target.id === 'discard-simulation-btn') this.toggleSimulationMode(false);
             if (e.target.id === 'generate-quality-label-btn') this.handleGenerateQualityLabel();
        });
        dashboardContent.addEventListener('input', e => {
            if (e.target.matches('.simulation-price-input')) {
                this.handleSimulationPriceChange(e.target.dataset.type, e.target.dataset.id, e.target.value);
            }
        });

        document.getElementById('analysis-date').value = new Date().toISOString().split('T')[0];
    }

    // --- AI & Settings Modal ---
    loadAiKey() { this.aiKey = localStorage.getItem('geminiAiKey') || ''; }
    saveAiKey() { const key = document.getElementById('ai-key-input').value; this.aiKey = key; localStorage.setItem('geminiAiKey', key); alert('AIキーを保存しました。'); this.closeModal(); }
    
    openSettingsModal() {
        const title = '設定';
        const content = `<div>
            <label for="ai-key-input" class="block text-sm font-medium text-gray-700">Gemini APIキー</label>
            <div class="mt-1">
                <input type="password" id="ai-key-input" class="block w-full rounded-md border-gray-300 shadow-sm p-2" value="${this.aiKey}">
            </div>
            <p class="text-xs text-gray-500 mt-1">AI機能を利用するには、Google AI Studioから取得したAPIキーを設定してください。</p>
        </div>`;
        const footer = `<button onclick="app.closeModal()" class="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300 transition mr-2">キャンセル</button>
                       <button id="save-ai-key-btn" class="bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 transition">保存</button>`;
        this.renderModal(title, content, footer);
        document.getElementById('save-ai-key-btn').onclick = () => this.saveAiKey();
    }

    callAiModel(parts) {
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${this.aiKey}`;
        const payload = { contents: [{ parts: parts }] };

        return fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error.message}`);
                });
            }
            return response.json();
        });
    }
    
    populateIngredientFormWithAIData(data) {
        if (!data) return;
        if (data.name) document.getElementById('ingredientName').value = data.name;
        if (data.subIngredients) document.getElementById('ingredientSubIngredients').value = data.subIngredients;
        if (data.calories) document.getElementById('ingredientCalories').value = data.calories;
        if (data.protein) document.getElementById('ingredientProtein').value = data.protein;
        if (data.fat) document.getElementById('ingredientFat').value = data.fat;
        if (data.carbs) document.getElementById('ingredientCarbs').value = data.carbs;
        if (data.salt) document.getElementById('ingredientSalt').value = data.salt;
        if (data.allergens && Array.isArray(data.allergens)) {
            document.querySelectorAll('.ingredient-allergen').forEach(cb => {
                cb.checked = data.allergens.some(allergen => cb.value.includes(allergen) || allergen.includes(cb.value));
            });
        }
    }
    
    handleReadFromImage() {
        const fileInput = document.getElementById('ai-image-input');
        const file = fileInput.files[0];
        if (!file) { alert('画像を選択してください。'); return; }
        if (!this.aiKey) { alert('AI機能を利用するには、まず設定画面でAPIキーを登録してください。'); return; }

        this.showLoader('画像を解析中...');

        this.resizeAndEncodeImage(file).then(base64Image => {
            const parts = [
                { text: `この画像から食品の情報を抽出し、指定されたJSON形式で返してください。
- name: 商品名
- calories: 熱量 (kcal, 数値のみ)
- protein: たんぱく質 (g, 数値のみ)
- fat: 脂質 (g, 数値のみ)
- carbs: 炭水化物 (g, 数値のみ)
- salt: 食塩相当量 (g, 数値のみ)
- allergens: アレルギー物質の文字列配列
- subIngredients: 原材料名の一覧（添加物含む）の文字列

ルール:
- 栄養成分は100gまたは100mlあたりを優先してください。見つからない場合はnullにしてください。
- JSONオブジェクトのみを返し、説明やマークダウンは含めないでください。` },
                { inline_data: { mime_type: file.type, data: base64Image } }
            ];
            
            return this.callAiModel(parts);
        })
        .then(result => {
            console.log("AI Response:", result);
            const text = result.candidates[0].content.parts[0].text;
            const jsonStr = text.match(/```json\n([\s\S]*?)\n```/)?.[1] || text;
            const extractedData = JSON.parse(jsonStr);
            this.populateIngredientFormWithAIData(extractedData);
            this.hideLoader();
        })
        .catch(err => {
            this.hideLoader();
            console.error(err);
            alert('AIによる解析に失敗しました: ' + err.message);
        });
    }

    resizeAndEncodeImage(file, maxWidth = 800, maxHeight = 800) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL(file.type);
                    resolve(dataUrl.split(',')[1]);
                };
                img.onerror = reject;
                img.src = event.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    handleGenerateQualityLabel() {
        if (!this.selectedProductId) { return; }
        if (!this.aiKey) { alert('AI機能を利用するには、まず設定画面でAPIキーを登録してください。'); return; }
        
        this.showLoader('品質表示を生成中...');

        const product = this.db.products.find(p => p.id === this.selectedProductId);
        const analysisDate = new Date(document.getElementById('analysis-date').value);
        const metrics = this.calculateMetricsForDate(product, analysisDate);
        
        const allIngredients = new Set();
        const allAllergens = new Set();
        
        metrics.usedIngredientsDetailed.forEach(item => {
            const mainIngredient = this.db.ingredients.find(i => i.id === item.id);
            if (mainIngredient) {
                allIngredients.add(mainIngredient.name);
                if (mainIngredient.subIngredients) {
                    mainIngredient.subIngredients.split(/[,、]/).forEach(sub => allIngredients.add(sub.trim()));
                }
                if (mainIngredient.allergens) {
                    mainIngredient.allergens.forEach(a => allAllergens.add(a));
                }
            }
        });

        const prompt = `あなたは日本の食品表示法のエキスパートです。以下の情報をもとに、法規に準拠した「一括表示」ラベルのテキストを生成してください。

商品名: ${product.name}
原材料リスト: ${Array.from(allIngredients).join(', ')}
アレルギー物質リスト: ${Array.from(allAllergens).join(', ')}
栄養成分 (商品全体):
- 熱量: ${metrics.nutrition.calories.toFixed(1)} kcal
- たんぱく質: ${metrics.nutrition.protein.toFixed(1)} g
- 脂質: ${metrics.nutrition.fat.toFixed(1)} g
- 炭水化物: ${metrics.nutrition.carbs.toFixed(1)} g
- 食塩相当量: ${metrics.nutrition.salt.toFixed(2)} g

生成するラベルの項目:
- 名称
- 原材料名 (添加物は「/」で区切るなど、一般的なルールに従ってください)
- 内容量 (「1個」としてください)
- 賞味期限 (「枠外下部に記載」としてください)
- 保存方法
- 製造者 (「(あなたの会社名)」としてください)
- 栄養成分表示

回答は、そのままコピーして使えるテキスト形式で、説明やマークダウンは含めないでください。`;

        this.callAiModel([{ text: prompt }])
            .then(result => {
                this.hideLoader();
                const labelText = result.candidates[0].content.parts[0].text;
                const title = `AI生成 品質表示ラベル: ${product.name}`;
                const content = `<pre class="whitespace-pre-wrap bg-gray-100 p-4 rounded-md text-sm">${labelText}</pre>`;
                const footer = `<button onclick="app.closeModal()" class="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300 transition mr-2">閉じる</button>`;
                this.renderModal(title, content, footer);
            })
            .catch(err => {
                this.hideLoader();
                alert('品質表示の生成に失敗しました: ' + err.message);
            });
    }

    renderModal(title, content, footer) { const container = document.getElementById('modal-container'); container.innerHTML = `<div id="app-modal" class="modal active fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center"><div class="relative mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white"><div class="flex justify-between items-center border-b pb-3"><h3 class="text-2xl font-bold">${title}</h3><div class="cursor-pointer z-50" onclick="app.closeModal()"><svg class="fill-current text-black" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><path d="M14.53 4.53l-1.06-1.06L9 7.94 4.53 3.47 3.47 4.53 7.94 9l-4.47 4.47 1.06 1.06L9 10.06l4.47 4.47 1.06-1.06L10.06 9z"></path></svg></div></div><div class="mt-4 max-h-[60vh] overflow-y-auto p-2">${content}</div><div class="mt-4 pt-4 border-t flex justify-end">${footer}</div></div></div>`; };
    closeModal() { document.getElementById('modal-container').innerHTML = ''; };
    showTab(tabId) { document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('hidden', p.id !== `${tabId}-content`)); document.querySelectorAll('.tab-button').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId)); if(tabId === 'dashboard') { this.renderAnalysisProductList(); } };
    renderAll() { this.renderIngredientTable(); this.renderRecipeList(); this.renderProductList(); this.renderAnalysisProductList(); if(this.selectedProductId) { this.runAnalysis(); } };
    renderIngredientTable() { if (!this.db || !this.db.ingredients) return; const tbody = document.getElementById('ingredient-table-body'); tbody.innerHTML = this.db.ingredients.map(ing => { const prices = this.db.ingredientPrices.filter(p => p.ingredientId === ing.id); const latestPrice = this.getActivePrice(prices, new Date()); return `<tr><td class="px-6 py-4 whitespace-nowrap font-medium">${ing.name}</td><td class="px-6 py-4 whitespace-nowrap">${latestPrice ? `${latestPrice.price}円 / ${latestPrice.unitAmount}${latestPrice.unitType}` : '未登録'}</td><td class="px-6 py-4 whitespace-nowrap"><button onclick="app.openIngredientModal('${ing.id}')" class="text-indigo-600 hover:text-indigo-900">編集</button><button onclick="app.confirmDelete('ingredients', '${ing.id}')" class="text-red-600 hover:text-red-900 ml-4">削除</button></td></tr>`; }).join('') || '<tr><td colspan="3" class="text-center py-4 text-gray-500">まだ原材料が登録されていません。</td></tr>'; };
    getIngredientPriceRow(index, data = {}) { const unitOptions = this.UNITS.map(u => `<option value="${u}" ${data.unitType === u ? 'selected' : ''}>${u}</option>`).join(''); const startDate = data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : ''; const isWeightUnit = !data.unitType || ['g', 'ml'].includes(data.unitType); return `<div class="price-row grid grid-cols-1 md:grid-cols-5 gap-2 items-center p-2 bg-gray-50 rounded-md"><div><label class="text-xs">価格(円) *</label><input type="number" required class="price-price w-full p-1 border rounded" value="${data.price || ''}"></div><div><label class="text-xs">数量 *</label><input type="number" required class="price-unit-amount w-full p-1 border rounded" value="${data.unitAmount || ''}"></div><div><label class="text-xs">単位 *</label><select class="price-unit-type w-full p-1 border rounded">${unitOptions}</select></div><div class="gram-equivalent-container ${isWeightUnit ? 'hidden' : ''}"><label class="text-xs">1単位の重量(g) *</label><input type="number" step="any" class="price-gram-equivalent w-full p-1 border rounded" value="${data.gramEquivalent || ''}" ${!isWeightUnit ? 'required' : ''}></div><div><label class="text-xs">開始日 *</label><input type="date" required class="price-start-date w-full p-1 border rounded" value="${startDate}"></div><div class="text-right self-end pb-1"><button type="button" class="remove-price-row text-red-500 hover:text-red-700 font-bold">×</button></div></div>`; };
    
    openIngredientModal(id = null) {
        const isEditing = id !== null;
        const ing = isEditing ? this.db.ingredients.find(i => i.id === id) : {};
        const prices = isEditing ? this.db.ingredientPrices.filter(p => p.ingredientId === id).sort((a,b) => new Date(a.startDate) - new Date(b.startDate)) : [];
        const title = isEditing ? '原材料の編集' : '新規原材料登録';
        
        const allergensHtml = this.ALLERGENS.map(allergen => `<label class="flex items-center space-x-2 text-sm"><input type="checkbox" class="ingredient-allergen" value="${allergen}" ${(ing.allergens || []).includes(allergen) ? 'checked' : ''}><span>${allergen}</span></label>`).join('');
        const priceRowsHtml = prices.map((p, index) => this.getIngredientPriceRow(index, p)).join('');
        
        let content = '<form id="ingredient-form" class="space-y-4">';
        
        const aiBlockHtml = `<div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 class="text-lg font-semibold text-blue-800">✨ AIによる自動入力</h4>
            <p class="text-sm text-blue-700 mt-1 mb-2">原材料表示の写真をアップロードすると、情報を自動で読み取ります。</p>
            <div class="flex items-center space-x-2">
                 <input type="file" id="ai-image-input" accept="image/*" class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                 <button type="button" id="read-image-btn" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 whitespace-nowrap">写真から読み取る</button>
            </div>
        </div>`;

        const formFieldsHtml = `<input type="hidden" id="ingredientId" value="${ing?.id || ''}">
            <div>
                <label class="block text-sm font-medium text-gray-700">原材料名 *</label>
                <input type="text" id="ingredientName" value="${ing?.name || ''}" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700">原材料の原材料</label>
                <textarea id="ingredientSubIngredients" rows="3" class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2" placeholder="例: カカオマス, 砂糖, ココアバター">${ing?.subIngredients || ''}</textarea>
            </div>
            <h4 class="text-lg font-semibold pt-4 border-b">栄養成分 (100gあたり)</h4>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><label class="block text-sm">熱量 (kcal)</label><input type="number" step="any" id="ingredientCalories" value="${ing?.calories || 0}" class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                <div><label class="block text-sm">タンパク質 (g)</label><input type="number" step="any" id="ingredientProtein" value="${ing?.protein || 0}" class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                <div><label class="block text-sm">脂質 (g)</label><input type="number" step="any" id="ingredientFat" value="${ing?.fat || 0}" class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                <div><label class="block text-sm">炭水化物 (g)</label><input type="number" step="any" id="ingredientCarbs" value="${ing?.carbs || 0}" class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                <div><label class="block text-sm">食塩相当量 (g)</label><input type="number" step="any" id="ingredientSalt" value="${ing?.salt || 0}" class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"></div>
            </div>
            <h4 class="text-lg font-semibold pt-4 border-b">その他情報</h4>
            <div><label class="block text-sm font-medium text-gray-700">アレルゲン</label><div class="grid grid-cols-3 md:grid-cols-4 gap-2 mt-2 p-2 border rounded-md">${allergensHtml}</div></div>
            <div><label class="block text-sm font-medium text-gray-700">オンラインサイトURL</label><input type="url" id="ingredientUrl" value="${ing?.url || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
            <h4 class="text-lg font-semibold pt-4 border-b">価格情報</h4>
            <div id="ingredient-prices-container" class="space-y-2">${priceRowsHtml}</div>
            <button type="button" id="add-price-row" class="text-sm text-indigo-600 hover:text-indigo-800">+ 価格期間を追加</button>`;
        
        content += aiBlockHtml + formFieldsHtml + '</form>';

        const footer = `<button onclick="app.closeModal()" class="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300 transition mr-2">キャンセル</button><button id="save-ingredient-btn" class="bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 transition">保存</button>`;
        
        this.renderModal(title, content, footer);
        document.getElementById('read-image-btn').addEventListener('click', () => this.handleReadFromImage());
        document.getElementById('add-price-row').addEventListener('click', () => { const container = document.getElementById('ingredient-prices-container'); container.insertAdjacentHTML('beforeend', this.getIngredientPriceRow(container.children.length)); });
        document.getElementById('ingredient-prices-container').addEventListener('click', e => { if (e.target.closest('.remove-price-row')) e.target.closest('.price-row').remove(); });
        document.getElementById('ingredient-prices-container').addEventListener('change', e => { if (e.target.classList.contains('price-unit-type')) { const row = e.target.closest('.price-row'); const container = row.querySelector('.gram-equivalent-container'); const isWeightUnit = ['g', 'ml'].includes(e.target.value); container.classList.toggle('hidden', isWeightUnit); row.querySelector('.price-gram-equivalent').required = !isWeightUnit; } });
        document.getElementById('save-ingredient-btn').addEventListener('click', () => this.handleSaveIngredient());
    }

    renderRecipeList() {
        if (!this.db || !this.db.recipes) return;
        const list = document.getElementById('recipe-list');
        list.innerHTML = this.db.recipes.map(recipe => `<div class="bg-white p-4 rounded-lg shadow"><h3 class="font-bold text-lg">${recipe.name}</h3><p class="text-sm text-gray-600">1回の生産量: ${recipe.yield || 'N/A'}個, 所要時間: ${recipe.time || 'N/A'}分</p><div class="mt-4"><button onclick="app.openRecipeModal('${recipe.id}')" class="text-indigo-600 hover:text-indigo-900">編集</button><button onclick="app.confirmDelete('recipes', '${recipe.id}')" class="text-red-600 hover:text-red-900 ml-4">削除</button></div></div>`).join('') || '<p class="text-gray-500">まだレシピが登録されていません。</p>';
    }

    openRecipeModal(id = null) {
        const isEditing = id !== null;
        const recipe = isEditing ? this.db.recipes.find(r => r.id === id) : {};
        const recipeIngredients = isEditing ? this.db.recipeIngredients.filter(ri => ri.recipeId === id) : [];
        const title = isEditing ? 'レシピの編集' : '新規レシピ登録';
        const getIngredientOptions = (selectedId) => this.db.ingredients.map(i => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${i.name}</option>`).join('');
        const ingredientRowsHtml = recipeIngredients.map((ri, index) => this.getRecipeIngredientRow(index, ri, getIngredientOptions(ri.ingredientId))).join('');
        const content = `<form id="recipe-form" class="space-y-4"><input type="hidden" id="recipeId" value="${recipe?.id || ''}"><div class="grid grid-cols-1 md:grid-cols-3 gap-4"><div class="md:col-span-3"><label class="block text-sm font-medium">レシピ名 *</label><input type="text" id="recipeName" value="${recipe?.name || ''}" required class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"></div><div><label class="block text-sm font-medium">1回の生産量 *</label><input type="number" id="recipeYield" value="${recipe?.yield || ''}" required class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"></div><div><label class="block text-sm font-medium">所要時間 (分) *</label><input type="number" id="recipeTime" value="${recipe?.time || ''}" required class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"></div></div><div><label class="block text-sm font-medium">作り方</label><textarea id="recipeInstructions" rows="5" class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2">${recipe?.instructions || ''}</textarea></div><h4 class="text-lg font-semibold pt-4 border-b">使用原材料</h4><div id="recipe-ingredients-container" class="space-y-2">${ingredientRowsHtml}</div><button type="button" id="add-recipe-ingredient-row" class="text-sm text-indigo-600 hover:text-indigo-800">+ 原材料を追加</button></form>`;
        const footer = `<button onclick="app.closeModal()" class="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300 transition mr-2">キャンセル</button><button id="save-recipe-btn" class="bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 transition">保存</button>`;
        this.renderModal(title, content, footer);
        document.getElementById('add-recipe-ingredient-row').addEventListener('click', () => { const container = document.getElementById('recipe-ingredients-container'); container.insertAdjacentHTML('beforeend', this.getRecipeIngredientRow(container.children.length, {}, getIngredientOptions(null))); });
        document.getElementById('recipe-ingredients-container').addEventListener('click', e => { if (e.target.closest('.remove-recipe-ingredient-row')) e.target.closest('.recipe-ingredient-row').remove(); });
        document.getElementById('save-recipe-btn').addEventListener('click', () => this.handleSaveRecipe());
    }
    getRecipeIngredientRow(index, data, options) { const unitOptions = this.UNITS.map(u => `<option value="${u}" ${data.unitType === u ? 'selected' : ''}>${u}</option>`).join(''); return `<div class="recipe-ingredient-row grid grid-cols-6 gap-2 items-center p-2 bg-gray-50 rounded-md"><select class="recipe-ingredient-id col-span-3 p-1 border rounded">${options}</select><input type="number" placeholder="使用量" class="recipe-ingredient-quantity col-span-1 p-1 border rounded" value="${data.quantity || ''}" required><select class="recipe-ingredient-unit-type col-span-1 p-1 border rounded">${unitOptions}</select><div class="text-right"><button type="button" class="remove-recipe-ingredient-row text-red-500 hover:text-red-700 font-bold">×</button></div></div>`; };
    
    renderProductList() {
        if (!this.db || !this.db.products) return;
        const list = document.getElementById('product-list');
        list.innerHTML = this.db.products.map(product => {
            const usedRecipes = this.db.productRecipes
                .filter(pr => pr.productId === product.id)
                .map(pr => {
                    const recipe = this.db.recipes.find(r => r.id === pr.recipeId);
                    return recipe ? recipe.name : '';
                })
                .filter(name => name)
                .join(', ');

            return `<div class="bg-white p-4 rounded-lg shadow flex flex-col justify-between">
                        <div>
                            <h3 class="font-bold text-lg">${product.name}</h3>
                            <p class="text-sm text-gray-500 mt-2 font-semibold">構成レシピ</p>
                            <p class="text-sm text-gray-600 truncate" title="${usedRecipes || 'なし'}">${usedRecipes || 'なし'}</p>
                        </div>
                        <div class="mt-4 pt-2 border-t">
                            <button onclick="app.openProductModal('${product.id}')" class="text-indigo-600 hover:text-indigo-900">編集</button>
                            <button onclick="app.confirmDelete('products', '${product.id}')" class="text-red-600 hover:text-red-900 ml-4">削除</button>
                        </div>
                    </div>`;
        }).join('') || '<p class="text-gray-500">まだ商品が登録されていません。</p>';
    }

    openProductModal(id = null) {
        const isEditing = id !== null;
        const product = isEditing ? this.db.products.find(p => p.id === id) : {};
        const productRecipes = isEditing ? this.db.productRecipes.filter(pr => pr.productId === id) : [];
        const productIngredients = isEditing ? this.db.productIngredients.filter(pi => pi.productId === id) : [];
        const prices = isEditing ? this.db.productPrices.filter(p => p.productId === id).sort((a, b) => new Date(a.startDate) - new Date(b.startDate)) : [];
        const title = isEditing ? '商品の編集' : '新規商品登録';
        const getIngredientOptions = (selectedId) => this.db.ingredients.map(i => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${i.name}</option>`).join('');
        const recipeCheckboxes = this.db.recipes.map(r => { const pr = productRecipes.find(pr => pr.recipeId === r.id); return `<div class="p-2 border rounded-md"><label class="flex items-center space-x-2"><input type="checkbox" class="product-recipe-checkbox" value="${r.id}" ${pr ? 'checked' : ''}><span>${r.name} (生産量: ${r.yield}個)</span></label><div class="mt-1"><label class="text-xs">使用個数</label><input type="number" class="product-recipe-quantity w-full p-1 text-sm border rounded" value="${pr ? pr.quantity : ''}" placeholder="0"></div></div>`; }).join('');
        const ingredientRowsHtml = productIngredients.map((pi, index) => this.getProductIngredientRow(index, pi, getIngredientOptions(pi.ingredientId))).join('');
        const priceRowsHtml = prices.map((p, index) => this.getProductPriceRow(index, p)).join('');
        const content = `<form id="product-form" class="space-y-4"><input type="hidden" id="productId" value="${product?.id || ''}"><div><label class="block text-sm font-medium">商品名 *</label><input type="text" id="productName" value="${product?.name || ''}" required class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"></div><div><label class="block text-sm font-medium">包装費 (1商品あたり)</label><input type="number" id="productPackagingCost" value="${product?.packagingCost || 0}" class="mt-1 w-full rounded-md border-gray-300 shadow-sm p-2"></div><h4 class="text-lg font-semibold pt-4 border-b">構成レシピ</h4><div class="grid grid-cols-2 md:grid-cols-3 gap-2">${recipeCheckboxes || '登録済みのレシピがありません。'}</div><h4 class="text-lg font-semibold pt-4 border-b">直接追加する原材料</h4><div id="product-ingredients-container" class="space-y-2">${ingredientRowsHtml}</div><button type="button" id="add-product-ingredient-row" class="text-sm text-indigo-600 hover:text-indigo-800">+ 原材料を追加</button><h4 class="text-lg font-semibold pt-4 border-b">販売価格</h4><div id="product-prices-container" class="space-y-2">${priceRowsHtml}</div><button type="button" id="add-product-price-row" class="text-sm text-indigo-600 hover:text-indigo-800">+ 販売価格を追加</button></form>`;
        const footer = `<button onclick="app.closeModal()" class="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300 transition mr-2">キャンセル</button><button id="save-product-btn" class="bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 transition">保存</button>`;
        this.renderModal(title, content, footer);
        document.getElementById('add-product-ingredient-row').addEventListener('click', () => { const container = document.getElementById('product-ingredients-container'); container.insertAdjacentHTML('beforeend', this.getProductIngredientRow(container.children.length, {}, getIngredientOptions(null))); });
        document.getElementById('product-ingredients-container').addEventListener('click', e => { if (e.target.closest('.remove-product-ingredient-row')) e.target.closest('.product-ingredient-row').remove(); });
        document.getElementById('add-product-price-row').addEventListener('click', () => { const container = document.getElementById('product-prices-container'); container.insertAdjacentHTML('beforeend', this.getProductPriceRow(container.children.length)); });
        document.getElementById('product-prices-container').addEventListener('click', e => { if (e.target.closest('.remove-product-price-row')) e.target.closest('.product-price-row').remove(); });
        document.getElementById('save-product-btn').addEventListener('click', () => this.handleSaveProduct());
    }
    getProductIngredientRow(index, data, options) { const unitOptions = this.UNITS.map(u => `<option value="${u}" ${data.unitType === u ? 'selected' : ''}>${u}</option>`).join(''); return `<div class="product-ingredient-row grid grid-cols-6 gap-2 items-center p-2 bg-gray-50 rounded-md"><select class="product-ingredient-id col-span-3 p-1 border rounded">${options}</select><input type="number" placeholder="使用量" class="product-ingredient-quantity col-span-1 p-1 border rounded" value="${data.quantity || ''}" required><select class="product-ingredient-unit-type col-span-1 p-1 border rounded">${unitOptions}</select><div class="text-right"><button type="button" class="remove-product-ingredient-row text-red-500 hover:text-red-700 font-bold">×</button></div></div>`; };
    getProductPriceRow(index, data = {}) { const startDate = data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : ''; return `<div class="product-price-row grid grid-cols-1 md:grid-cols-3 gap-2 items-center p-2 bg-gray-50 rounded-md"><div><label class="text-xs">販売価格(円) *</label><input type="number" required class="product-price-price w-full p-1 border rounded" value="${data.price || ''}"></div><div><label class="text-xs">開始日 *</label><input type="date" required class="product-price-start-date w-full p-1 border rounded" value="${startDate}"></div><div class="text-right self-end pb-1"><button type="button" class="remove-product-price-row text-red-500 hover:text-red-700 font-bold">×</button></div></div>`; };
    
    // --- Simulation Logic ---
    toggleSimulationMode(forceState = null) {
        this.isSimulationMode = forceState !== null ? forceState : !this.isSimulationMode;
        document.getElementById('simulation-mode-toggle').checked = this.isSimulationMode;
        if (this.isSimulationMode) { this.simulationPrices = { product: null, ingredients: {} }; }
        document.getElementById('simulation-actions').classList.toggle('hidden', !this.isSimulationMode);
        this.runAnalysis();
    }

    handleSimulationPriceChange(type, id, value) {
        const numValue = value === '' ? null : Number(value);
        if (type === 'product') {
            this.simulationPrices.product = numValue;
        } else if (type === 'ingredient') {
            this.simulationPrices.ingredients[id] = numValue;
        }
        const product = this.db.products.find(p => p.id === this.selectedProductId);
        const analysisDate = new Date(document.getElementById('analysis-date').value);
        const originalMetrics = this.calculateMetricsForDate(product, analysisDate);
        const simulatedMetrics = this.calculateMetricsForDate(product, analysisDate, this.simulationPrices);
        this.updateSimulationView(originalMetrics, simulatedMetrics);
    }
    
    openSaveSimulationModal() {
        const title = 'シミュレーション価格の保存';
        const content = `<div>
            <label for="sim-start-date" class="block text-sm font-medium text-gray-700">これらの新しい価格をいつから適用しますか？</label>
            <input type="date" id="sim-start-date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value="${new Date().toISOString().split('T')[0]}">
            <p class="text-xs text-gray-500 mt-2">指定した開始日で、シミュレーションで変更したすべての価格が新しい価格として登録されます。</p>
        </div>`;
        const footer = `<button onclick="app.closeModal()" class="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300 transition mr-2">キャンセル</button>
                       <button id="confirm-save-sim" class="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition">保存</button>`;
        this.renderModal(title, content, footer);
        document.getElementById('confirm-save-sim').onclick = () => this.handleSaveSimulation();
    }

    handleSaveSimulation() {
        const startDate = document.getElementById('sim-start-date').value;
        if (!startDate) { alert('開始日を入力してください。'); return; }
        this.closeModal();

        const payload = {
            productId: this.selectedProductId,
            startDate: startDate,
            productPrice: this.simulationPrices.product,
            ingredientPrices: this.simulationPrices.ingredients
        };
        
        this.showLoader('シミュレーション価格を保存中...');
        
        this.callApi('saveSimulationPrices', payload)
            .then(response => {
                if (response.success) {
                    this.toggleSimulationMode(false);
                    this.init();
                } else {
                    this.hideLoader();
                    alert('保存に失敗しました: ' + response.error);
                }
            })
            .catch(err => {
                this.hideLoader();
                alert('サーバーとの通信に失敗しました: ' + err.message);
            });
    }

    renderAnalysisProductList() { if (!this.db || !this.db.products) return; const list = document.getElementById('analysis-product-list'); if (!list) return; const productButtons = this.db.products.map(p => `<button data-id="${p.id}" class="product-button w-full text-left p-2 rounded-md border ${this.selectedProductId === p.id ? 'active' : 'bg-white hover:bg-gray-50'}">${p.name}</button>`).join(''); list.innerHTML = productButtons || '<p class="text-sm text-gray-500">商品がありません</p>'; };
    
    runAnalysis() {
        const analysisDateStr = document.getElementById('analysis-date').value;
        if (!this.selectedProductId || !analysisDateStr) {
            document.getElementById('analysis-result').classList.add('hidden');
            document.getElementById('analysis-placeholder').classList.remove('hidden');
            return;
        }
        const product = this.db.products.find(p => p.id === this.selectedProductId);
        if (!product) return;
        
        const analysisDate = new Date(analysisDateStr);
        const originalMetrics = this.calculateMetricsForDate(product, analysisDate);
        let simulatedMetrics = null;
        if (this.isSimulationMode) {
            simulatedMetrics = this.calculateMetricsForDate(product, analysisDate, this.simulationPrices);
        }
        this.renderAnalysisResult(product, originalMetrics, simulatedMetrics);
    };
    
    getActivePrice(prices, date) {
        if(!prices || prices.length === 0) return null;
        const sortedPrices = prices.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        const relevantPrices = sortedPrices.filter(p => new Date(p.startDate) <= date);
        return relevantPrices.length > 0 ? relevantPrices[relevantPrices.length - 1] : null;
    }

    calculateMetricsForDate(product, date, simulationOverrides = null) {
        const useSim = !!simulationOverrides;
        let price;
        if (useSim && simulationOverrides.product !== null && simulationOverrides.product !== undefined) {
            price = Number(simulationOverrides.product);
        } else {
            const relevantProductPrice = this.getActivePrice(this.db.productPrices.filter(p => p.productId === product.id), date);
            price = relevantProductPrice ? Number(relevantProductPrice.price) : 0;
        }

        const usedIngredientsMap = new Map();
        this.db.productRecipes.filter(pr => pr.productId === product.id).forEach(pr => { const recipe = this.db.recipes.find(r => r.id === pr.recipeId); if (!recipe || !recipe.yield || recipe.yield == 0) return; const recipeMultiplier = (pr.quantity || 0) / recipe.yield; this.db.recipeIngredients.filter(ri => ri.recipeId === recipe.id).forEach(ri => { this.addIngredientToMap(usedIngredientsMap, ri.ingredientId, ri.quantity, ri.unitType, date, recipeMultiplier, simulationOverrides); }); });
        this.db.productIngredients.filter(pi => pi.productId === product.id).forEach(pi => { this.addIngredientToMap(usedIngredientsMap, pi.ingredientId, pi.quantity, pi.unitType, date, 1, simulationOverrides); });
        
        let usedIngredientsDetailed = Array.from(usedIngredientsMap.values());
        const packagingCost = Number(product.packagingCost || 0);
        const ingredientsTotalCost = usedIngredientsDetailed.reduce((sum, item) => sum + item.totalCost, 0);
        const totalCost = ingredientsTotalCost + packagingCost;
        usedIngredientsDetailed.forEach(item => { item.costRatio = totalCost > 0 ? (item.totalCost / totalCost) * 100 : 0; });
        
        const totalNutrition = usedIngredientsDetailed.reduce((totals, item) => { totals.calories += item.nutrition.calories; totals.protein += item.nutrition.protein; totals.fat += item.nutrition.fat; totals.carbs += item.nutrition.carbs; totals.salt += item.nutrition.salt; return totals; }, { calories: 0, protein: 0, fat: 0, carbs: 0, salt: 0 });
        
        const profit = price - totalCost;
        const costRate = price > 0 ? (totalCost / price) * 100 : 0;
        const profitRate = price > 0 ? (profit / price) * 100 : 0;
        
        return { cost: totalCost, price: price, profit: profit, costRate, profitRate, nutrition: totalNutrition, usedIngredientsDetailed };
    };
    
    addIngredientToMap(map, ingredientId, quantity, unitType, date, multiplier, simulationOverrides) {
        const ingredient = this.db.ingredients.find(i => i.id === ingredientId);
        if (!ingredient) return;
        
        const useSim = !!simulationOverrides;
        let ingredientCost = 0;
        const ingPriceInfo = this.getActivePrice(this.db.ingredientPrices.filter(p => p.ingredientId === ingredient.id), date);
        
        let priceToUse, unitAmountToUse;
        if(useSim && simulationOverrides.ingredients[ingredientId] !== undefined && simulationOverrides.ingredients[ingredientId] !== null) {
            priceToUse = Number(simulationOverrides.ingredients[ingredientId]);
            unitAmountToUse = ingPriceInfo ? Number(ingPriceInfo.unitAmount) : 0;
        } else {
            priceToUse = ingPriceInfo ? Number(ingPriceInfo.price) : 0;
            unitAmountToUse = ingPriceInfo ? Number(ingPriceInfo.unitAmount) : 0;
        }

        if (unitAmountToUse > 0) {
            ingredientCost = multiplier * (priceToUse / unitAmountToUse) * Number(quantity);
        }

        let gramEquivalent = 1;
        if (unitType !== 'g' && unitType !== 'ml') {
            const unitPriceInfo = this.getActivePrice(this.db.ingredientPrices.filter(p => p.ingredientId === ingredient.id && p.unitType === unitType), date);
            gramEquivalent = (unitPriceInfo && unitPriceInfo.gramEquivalent) ? Number(unitPriceInfo.gramEquivalent) : 0;
        }
        const quantityInGrams = multiplier * Number(quantity) * gramEquivalent;
        
        if (!map.has(ingredient.id)) { map.set(ingredient.id, { id: ingredient.id, name: ingredient.name, totalGrams: 0, totalCost: 0, nutrition: { calories: 0, protein: 0, fat: 0, carbs: 0, salt: 0 }}); }
        const current = map.get(ingredient.id);
        current.totalGrams += quantityInGrams;
        current.totalCost += ingredientCost;
        current.nutrition.calories += (Number(ingredient.calories || 0) / 100) * quantityInGrams;
        current.nutrition.protein += (Number(ingredient.protein || 0) / 100) * quantityInGrams;
        current.nutrition.fat += (Number(ingredient.fat || 0) / 100) * quantityInGrams;
        current.nutrition.carbs += (Number(ingredient.carbs || 0) / 100) * quantityInGrams;
        current.nutrition.salt += (Number(ingredient.salt || 0) / 100) * quantityInGrams;
    }

    renderAnalysisResult(product, originalMetrics, simulatedMetrics) {
        document.getElementById('analysis-placeholder').classList.add('hidden');
        document.getElementById('analysis-result').classList.remove('hidden');
        document.getElementById('analysis-product-name').textContent = `分析結果: ${product.name}`;
        
        this.renderSimulationSummary(originalMetrics, simulatedMetrics);

        document.getElementById('analysis-nutrition').innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm"><p><strong>総熱量:</strong> ${originalMetrics.nutrition.calories.toFixed(1)} kcal</p><p><strong>タンパク質:</strong> ${originalMetrics.nutrition.protein.toFixed(1)} g</p><p><strong>脂質:</strong> ${originalMetrics.nutrition.fat.toFixed(1)} g</p><p><strong>炭水化物:</strong> ${originalMetrics.nutrition.carbs.toFixed(1)} g</p><p><strong>食塩相当量:</strong> ${originalMetrics.nutrition.salt.toFixed(2)} g</p></div>`;
        
        this.renderSimulationIngredientsTable(originalMetrics, simulatedMetrics);
    };
    
    updateSimulationView(originalMetrics, simulatedMetrics) {
        this.updateSimulationSummary(originalMetrics, simulatedMetrics);
        this.updateSimulationIngredientsTable(originalMetrics, simulatedMetrics);
    }

    renderSimulationSummary(originalMetrics, simulatedMetrics) {
        const createSummaryItemHTML = (id, label, originalValue, simValue, isPriceInput = false) => {
            let displayHTML;
            if (this.isSimulationMode && isPriceInput) {
                const simPriceValue = (this.simulationPrices.product !== null) ? this.simulationPrices.product : originalMetrics.price;
                 displayHTML = `<div class="flex items-center justify-center gap-1">
                                <span class="text-xl font-bold text-gray-500">${originalMetrics.price.toFixed(0)}円</span>
                                <span class="sim-arrow">→</span>
                                <input type="number" data-type="product" class="simulation-price-input w-24 p-1 border rounded text-xl font-bold text-center sim-value" value="${simPriceValue}">
                            </div>`;
            } else {
                let valueHTML = originalValue;
                if(this.isSimulationMode && simValue !== undefined && originalValue !== simValue) {
                    valueHTML = `${originalValue} <span class="sim-arrow">→</span> <span class="sim-value">${simValue}</span>`;
                }
                displayHTML = `<p class="text-2xl font-bold">${valueHTML}</p>`;
            }
            return `<div id="${id}"><p class="text-sm text-gray-500">${label}</p>${displayHTML}</div>`;
        };

        const sim = simulatedMetrics;
        document.getElementById('analysis-summary').innerHTML = 
            createSummaryItemHTML('summary-cost', '原価', `${originalMetrics.cost.toFixed(1)}円`, sim ? `${sim.cost.toFixed(1)}円` : undefined) +
            createSummaryItemHTML('summary-price', '販売価格', `${originalMetrics.price.toFixed(0)}円`, sim ? `${sim.price.toFixed(0)}円` : undefined, true) +
            createSummaryItemHTML('summary-profit', '利益', `${originalMetrics.profit.toFixed(1)}円`, sim ? `${sim.profit.toFixed(1)}円` : undefined) +
            createSummaryItemHTML('summary-profitRate', '利益率', `${originalMetrics.profitRate.toFixed(1)}%`, sim ? `${sim.profitRate.toFixed(1)}%` : undefined);
    }
    
    updateSimulationSummary(originalMetrics, simulatedMetrics) {
        const createValueHTML = (originalValue, simValue) => {
            if(this.isSimulationMode && simValue !== undefined && originalValue !== simValue) {
                return `${originalValue} <span class="sim-arrow">→</span> <span class="sim-value">${simValue}</span>`;
            }
            return originalValue;
        };
        const sim = simulatedMetrics;

        const costEl = document.querySelector('#summary-cost .font-bold');
        if (costEl) costEl.innerHTML = createValueHTML(`${originalMetrics.cost.toFixed(1)}円`, sim ? `${sim.cost.toFixed(1)}円` : undefined);

        const profitEl = document.querySelector('#summary-profit .font-bold');
        if (profitEl) profitEl.innerHTML = createValueHTML(`${originalMetrics.profit.toFixed(1)}円`, sim ? `${sim.profit.toFixed(1)}円` : undefined);
        
        const profitRateEl = document.querySelector('#summary-profitRate .font-bold');
        if (profitRateEl) profitRateEl.innerHTML = createValueHTML(`${originalMetrics.profitRate.toFixed(1)}%`, sim ? `${sim.profitRate.toFixed(1)}%` : undefined);
    }
    
    renderSimulationIngredientsTable(originalMetrics, simulatedMetrics) {
        const ingredientsTableContainer = document.getElementById('analysis-ingredients-table-container');
        const sortedIngredients = originalMetrics.usedIngredientsDetailed.sort((a, b) => b.totalGrams - a.totalGrams);
        const analysisDate = new Date(document.getElementById('analysis-date').value);

        let tableHeader = `<th class="px-4 py-2 text-left font-medium text-gray-500">原材料</th>`;
        if(this.isSimulationMode) {
            tableHeader += `<th class="px-4 py-2 text-right font-medium text-gray-500">最新価格</th><th class="px-4 py-2 text-right font-medium text-gray-500">シミュレーション価格</th>`;
        }
        tableHeader += `<th class="px-4 py-2 text-right font-medium text-gray-500">使用量(g)</th><th class="px-4 py-2 text-right font-medium text-gray-500">原価(円)</th>`;

        const tableRows = sortedIngredients.map(item => {
            const latestPriceInfo = this.getActivePrice(this.db.ingredientPrices.filter(p => p.ingredientId === item.id), analysisDate);
            const latestPriceHtml = latestPriceInfo ? `${latestPriceInfo.price}円 / ${latestPriceInfo.unitAmount}${latestPriceInfo.unitType}` : 'N/A';
            
            let simCostHtml = '';
            let currentCost = item.totalCost;

            if(simulatedMetrics) {
                const simItem = simulatedMetrics.usedIngredientsDetailed.find(i => i.id === item.id);
                if (simItem && simItem.totalCost.toFixed(2) !== item.totalCost.toFixed(2)) {
                    simCostHtml = `<span class="sim-arrow ml-1">→</span> <span class="sim-value">${simItem.totalCost.toFixed(2)}</span>`;
                }
            }

            let rowHtml = `<tr data-ingredient-id="${item.id}"><td class="px-4 py-2 whitespace-nowrap">${item.name}</td>`;
            if(this.isSimulationMode) {
                const simPriceValue = (this.simulationPrices.ingredients[item.id] !== undefined && this.simulationPrices.ingredients[item.id] !== null) ? this.simulationPrices.ingredients[item.id] : (latestPriceInfo ? latestPriceInfo.price : '');
                rowHtml += `<td class="px-4 py-2 text-right text-sm text-gray-600">${latestPriceHtml}</td>`;
                rowHtml += `<td class="px-4 py-2 text-right"><input type="number" data-type="ingredient" data-id="${item.id}" class="simulation-price-input w-24 p-1 border rounded text-right" value="${simPriceValue}"></td>`;
            }
            rowHtml += `<td class="px-4 py-2 text-right">${item.totalGrams.toFixed(1)}</td><td class="px-4 py-2 text-right cost-cell">${currentCost.toFixed(2)}${simCostHtml}</td></tr>`;
            return rowHtml;
        }).join('');
        
        ingredientsTableContainer.innerHTML = `<table class="min-w-full bg-white text-sm"><thead class="bg-gray-50"><tr>${tableHeader}</tr></thead><tbody class="divide-y divide-gray-200">${tableRows}</tbody></table>`;
    }
    
    updateSimulationIngredientsTable(originalMetrics, simulatedMetrics) {
        const tableBody = document.querySelector('#analysis-ingredients-table-container tbody');
        if (!tableBody) return;
        
        tableBody.querySelectorAll('tr').forEach(row => {
            const ingId = row.dataset.ingredientId;
            const costCell = row.querySelector('.cost-cell');
            if (!ingId || !costCell) return;
            
            const originalItem = originalMetrics.usedIngredientsDetailed.find(i => i.id === ingId);
            const simItem = simulatedMetrics.usedIngredientsDetailed.find(i => i.id === ingId);
            
            if (originalItem && simItem) {
                let simCostHtml = '';
                if (simItem.totalCost.toFixed(2) !== originalItem.totalCost.toFixed(2)) {
                    simCostHtml = `<span class="sim-arrow ml-1">→</span> <span class="sim-value">${simItem.totalCost.toFixed(2)}</span>`;
                }
                costCell.innerHTML = `${originalItem.totalCost.toFixed(2)}${simCostHtml}`;
            }
        });
    }
}

const app = new RecipeApp();
