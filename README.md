# japan-trip-2026

`japan-trip-2026` 是 2026/10/11–2026/10/18 日本旅行的整理專案。

目前以資料結構為主，主軸區域為：靜岡、修善寺、箱根、東京。
這份結構已整理成可作為後續 PDF 與互動地圖網頁的資料來源。

## 專案用途

- 集中整理每日行程草稿
- 整理餐廳清單與 Google Maps 連結欄位
- 統一保存地點資料，作為後續 PDF 與地圖頁面的資料來源

## 目前原則

- 使用繁體中文
- 不自行新增未提供的餐廳或景點
- 沒有座標的地點，`lat` / `lng` 使用 `null`
- Google Maps 連結欄位保留，不任意補填

## 資料結構

### `data/itinerary.yaml`

每日行程已整理為 `itinerary` 陣列，每一天固定包含以下欄位：

- `date`
- `weekday`
- `title`
- `area`
- `accommodation`
- `theme`
- `timeline`
- `transportation`
- `meals`
- `backup_plan`
- `notes`

`timeline` 內每個項目固定包含：

- `start_time`
- `end_time`
- `title`
- `location`
- `transport`
- `description`
- `related_restaurant_ids`
- `related_place_ids`

這個結構適合：

- 直接轉成每日 PDF 區塊
- 依 `timeline` 排序產生手機版行程頁
- 用 `related_restaurant_ids`、`related_place_ids` 串接餐廳與地點資料

### `data/restaurants.yaml`

餐廳已整理為 `restaurants` 陣列，每一筆都是單一餐廳主檔，固定包含：

- `id`
- `date`
- `area`
- `meal_type`
- `priority`
- `name`
- `japanese_name`
- `google_maps_url`
- `notes`
- `lat`
- `lng`

這個結構適合：

- 依日期與餐期排序產生餐廳清單 PDF
- 用 `priority` 區分第一順位與備案
- 由 `id` 回連到 `itinerary.yaml`

### `data/places.yaml`

地點已整理為 `places` 陣列，每一筆固定包含：

- `id`
- `name`
- `area`
- `category`
- `google_maps_url`
- `lat`
- `lng`
- `notes`

這個結構適合：

- 作為互動地圖與地點索引主檔
- 依 `category` 分流景點、交通、住宿、餐廳
- 搭配 `id` 與 `itinerary.yaml`、`restaurants.yaml` 串接

## 檔案結構

```text
japan-trip-2026/
├─ README.md
├─ itinerary.md
├─ restaurants.md
└─ data/
   ├─ itinerary.yaml
   ├─ restaurants.yaml
   ├─ places.yaml
   └─ transportation.yaml
```

## 檔案說明

- `README.md`：專案說明與檔案結構
- `itinerary.md`：適合手機閱讀的每日行程草稿
- `restaurants.md`：依日期與餐期整理餐廳欄位
- `data/itinerary.yaml`：每日行程主檔，適合後續輸出 PDF 與網頁
- `data/restaurants.yaml`：餐廳主檔，依日期、餐期與順位整理
- `data/places.yaml`：地點主檔，供地圖與資料串接使用
- `data/transportation.yaml`：每日交通、重要車次方案、預約狀態與購票連結
- `scripts/validate_data.py`：驗證 YAML 結構與 id 對應是否正確

## 如何驗證資料

若系統環境已有 Python，可在專案根目錄執行：

```bash
python scripts/validate_data.py
```

若使用本工作區內建的 Python，可執行：

```powershell
& "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" scripts/validate_data.py
```

驗證內容包含：

- 四個 YAML 檔案是否可成功解析
- `itinerary.yaml` 內 `related_restaurant_ids` 是否都能對應到 `restaurants.yaml`
- `itinerary.yaml` 內 `related_place_ids` 是否都能對應到 `places.yaml`
- `restaurants.yaml` 與 `places.yaml` 的必要欄位是否完整
- `transportation.yaml` 的每日交通、重要車次方案與購票連結欄位是否完整

## 如何開啟列印版並另存 PDF

列印版檔案位於：

- `pdf/itinerary-print.html`
- `pdf/print.css`

開啟方式：

1. 用瀏覽器直接開啟 `pdf/itinerary-print.html`
2. 確認版面正常後，使用瀏覽器的列印功能
3. 目的地選擇「另存為 PDF」
4. 紙張大小使用 `A4`
5. 版面方向使用 `直式`
6. 邊界建議使用預設或最小，保持版面完整

這個版面已針對列印與瀏覽器另存 PDF 調整，不需要依賴地點座標顯示。

## 如何開啟手機版互動行程網頁

手機版網頁檔案位於：

- `web/index.html`
- `web/style.css`
- `web/app.js`
- `web/data.js`

離線資料產生腳本位於：

- `scripts/build_web_data.py`

若手機版網頁資料有更新，請重新執行 build。腳本會同步產生 `web/data.js` 與 GitHub Pages 使用的 `docs/data.js`，不要手動編輯這兩個檔案。

可用系統 Python 執行：

```bash
python scripts/build_web_data.py
```

若使用本工作區內建的 Python，可執行：

```powershell
& "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" scripts/build_web_data.py
```

開啟方式：

1. 先執行 `scripts/build_web_data.py`
2. 用瀏覽器直接開啟 `web/index.html`
3. 首頁會先顯示 `2026/10/11–2026/10/18` 行程總覽
4. 使用上方每日按鈕切換各天行程
5. 這一版不包含 Leaflet 地圖，先以手機查閱動線、時間軸與餐廳資訊為主

### 地圖／導航索引使用方式

手機版網頁上方提供 `地圖／導航` 分頁，功能包含：

- 依日期分組列出當天相關景點、餐廳、住宿、交通節點
- 可用名稱或區域搜尋
- 可用 `全部 / 景點 / 餐廳 / 住宿 / 交通` 篩選
- 若有 Google Maps 連結，可直接點擊開啟
- 若尚未提供地圖連結，畫面會顯示提示，不會報錯

## 如何部署到 GitHub Pages

這個專案可使用 `docs/` 資料夾作為 GitHub Pages 靜態網站來源。

部署步驟如下：

1. 建立 GitHub repository
2. 上傳整個專案
3. 到 `Settings` → `Pages`
4. `Source` 選 `Deploy from a branch`
5. `Branch` 選 `main`
6. `Folder` 選 `/docs`
7. 儲存後等待部署完成
8. 完成後取得網站網址
