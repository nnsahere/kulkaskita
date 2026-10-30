# 🧊🐻 KulkasKita

**Eat it before it expires.**

A smart virtual fridge that helps households cut food waste. Scan a grocery receipt, let the app log every item with an estimated expiry date, and watch a friendly polar bear change its mood to show how fresh your fridge is.

Built for **SIC 2026** · Theme: *Human as the End of Innovation* · **SDG 12: Responsible Consumption and Production**

---

## The problem

According to UNEP (2024), 1.05 billion tonnes of food were wasted in 2022, and about 60% of it came from households. In our survey of 41 respondents:

- 65.9% forget food expiration dates
- 48.8% do not have enough time to cook
- 24.4% are unsure what to cook
- 24.4% buy more ingredients than they need

KulkasKita targets students, boarding-house residents, and household kitchen managers who want less typing, fewer forgotten groceries, and quick ideas for what to cook.

## Features

| Feature | What it does |
|---|---|
| **Receipt scanner** | Take or choose a photo, crop it to the receipt, then OCR reads every line. Recognized food is highlighted in green. |
| **Automatic expiry dates** | Each recognized item gets an estimated shelf life from a built-in food knowledge base. Everything stays editable. |
| **Freshness bear** | The bear's mood shows how fresh your fridge is, based on the item closest to expiry (5 levels, see below). |
| **Food rescue gauge** | Shows the share of your food that you used before it expired. |
| **Expiry alerts** | Reminders 1 to 3 days before items expire, in the app and optionally as browser notifications. |
| **Recipe Rescue** | Recipe suggestions based on what you have, prioritizing items that need to be used soon. |
| **Meal plan and shopping list** | Plan the week, auto-fill from your fridge, and add missing ingredients to a shopping list. |
| **Interactive tutorial** | A hands-on tour on a practice fridge, so your real data is never touched. |
| **Demo mode** | Fast-forward the clock by one day to watch the bear react. |

### Freshness levels

| Level | Days left | Bear mood |
|---|---|---|
| Safe | 8 or more | Cheerful |
| Good | 5 to 7 | Calm |
| Fair | 3 to 4 | Sweating |
| Expiring soon | 0 to 2 | Panicking |
| Expired | Past the date | Queasy |

## How it works

```
photo → crop → preprocess → OCR → line parser → food match → review → fridge
```

1. **Crop:** the user crops the photo to just the receipt.
2. **Preprocess:** the image is scaled, converted to grayscale, and its contrast is boosted.
3. **OCR:** [Tesseract.js](https://github.com/naptha/tesseract.js) reads the text line by line.
4. **Parse:** each line is cleaned (prices, store noise, and OCR typos removed) and matched against the food knowledge base. Exact keywords are tried first, then fuzzy matching (Levenshtein distance) to survive misreads.
5. **Estimate:** expiry date = purchase date + typical shelf life for that food.
6. **Review:** the user fixes anything that is off and saves the items to the fridge.

> **About "AI":** OCR is machine-learning based (Tesseract). Matching and shelf-life estimates are rule-based, using a food database with typical storage times. They are estimates and can always be adjusted.

## Tech stack

- HTML, CSS, and vanilla JavaScript (no framework, no build step)
- [Tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 for OCR (loaded from a CDN)
- `localStorage` for data (no backend)
- Poppins font (Google Fonts)

## Run it locally

The camera and OCR need the page to be served over `http://localhost` (opening `index.html` directly with `file://` will not work properly).

**Option 1: VS Code Live Server**
Open the project folder in VS Code, then right-click `index.html` and choose **Open with Live Server**.

**Option 2: Python**
```bash
python3 -m http.server 8000
```
Then open <http://localhost:8000>.

An internet connection is needed the first time you scan, because Tesseract.js and its language data are downloaded then.

## Project structure

```
kulkaskita/
├── index.html        # page shell + favicon
├── css/style.css     # all styles (later blocks override earlier ones)
├── js/
│   ├── logic.js      # pure logic: food database, receipt parser, dates, levels, recipes
│   └── app.js        # UI, screens, tutorial, crop editor, OCR pipeline, router
└── assets/           # mascot moods, poses, navbar icons, pattern, logo
```

## Customizing

- **Mascot images:** replace files in `assets/` (`mascot-<level>.png`, `pose-1..6.png`, `nav-*.png`) and keep the same names.
- **Which pose or mood a screen uses:** edit `POSE` and `CLOSE` near the top of `js/app.js`.
- **Colors:** the CSS variables at the top of `css/style.css` (`--turq`, `--blue`, `--yellow`, ...).
- **Food list and shelf life:** `FOODS` in `js/logic.js`.
- **Tutorial steps:** the `TUT` array in `js/app.js`.

## Limitations

- Shelf life values are general estimates, not guarantees. Always check the item before eating.
- Accounts are demo-level and live only in this browser's `localStorage`. Data does not sync between devices.
- OCR accuracy depends on photo quality. Crop tightly and keep the receipt flat and well lit.

## Roadmap

**Short term:** better receipt accuracy (more Indonesian store formats and products), more recipes, installable app (PWA) with push notifications.

**Mid term:**
- Storage-aware shelf life: choose room temperature, fridge, or freezer and update expiry dates automatically
- Accounts with cloud sync and barcode scanning
- Shared fridge for families and boarding houses

**Long term:** AI recipe suggestions, a "food saved" impact report (kg and Rupiah), and partnerships with local food-sharing communities.

## Team

- Putri Anisa La Ananila
- Aykho Praysila Zai
- Kaylin Patricia

---

*Less waste, less spending, and a better planet, starting from your fridge.*
