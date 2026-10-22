"""Builds data/pantry.json, data/meals.json and data/prices.json from the
Oct 21, 2026 heb.com pull (H-E-B Main St, store 789, Frisco).

Run from the repo root:  python3 tools/build_data.py
"""
import json
from pathlib import Path

PULL_DATE = "2026-10-21"
STORE = {"name": "H-E-B Main St", "number": 789, "address": "4800 Main St, Frisco TX 75033"}

# key, HEB product id, product name, size, section (shopping-list group),
# aisle text from heb.com, list price, current price, flags, coupon
RAW = [
    # Tacos (Tue)
    ("ground-beef",      "1661154",  "H-E-B Prime 1 Ground Beef Chuck, 80% Lean", "1 lb", "Meat", "In Meat Market on the Left Wall", 7.49, 7.49, "", None),
    ("taco-seasoning",   "706450",   "H-E-B Taco Seasoning Mix", "1.25 oz", "Pantry", "Aisle 8", 0.68, 0.68, "coupon", "Buy H-E-B Flour Tortillas 20 ct, get this free (exp 2026-11-03)"),
    ("flour-tortillas",  "465325",   "H-E-B Bakery Flour Tortillas", "20 ct", "Bakery", "On the Right Edge of Bakery", 4.88, 3.96, "pricecut", None),
    ("shredded-cheddar", "127182",   "H-E-B Mild Cheddar Shredded Cheese", "8 oz", "Dairy", "In Meat Market on the Back Wall", 2.98, 2.98, "coupon", "Buy Mi Tienda Fully Cooked Fajitas, get this free (exp 2026-10-27)"),
    ("sour-cream",       "314026",   "H-E-B Regular Sour Cream", "16 oz", "Dairy", "In Dairy on the Right Wall", 2.40, 2.40, "", None),
    ("iceberg-lettuce",  "319375",   "Fresh Iceberg Lettuce", "Each", "Produce", "In Produce on the Left Wall", 2.29, 2.29, "", None),
    ("roma-tomatoes",    "318578",   "Fresh Roma Tomato", "Avg. 0.29 lb (price is per tomato)", "Produce", "In Produce", 0.22, 0.22, "", None),
    ("salsa",            "3463050",  "H-E-B Fresh Salsa - Mild", "16 oz", "Produce", "In Produce on the Front Wall", 4.26, 4.26, "", None),
    ("pico",             "2159976",  "H-E-B Pico de Gallo - Mild", "14 oz", "Produce", "In Produce on the Front Wall", 4.98, 4.98, "", None),
    ("mexican-blend",    "543845",   "H-E-B Mexican Style Shredded Cheese Blend", "8 oz", "Dairy", "In Meat Market on the Back Wall", 2.98, 2.98, "", None),
    # Spaghetti (Wed)
    ("spaghetti",        "1567287",  "H-E-B Spaghetti Noodles", "16 oz", "Pantry", "Aisle 7", 1.12, 1.12, "", None),
    ("marinara",         "1535352",  "H-E-B Healthy Marinara Pasta Sauce", "15.5 oz", "Pantry", "Aisle 7", 2.58, 2.20, "pricecut", None),
    ("parmesan",         "3656524",  "H-E-B Grated Parmesan Cheese", "8 oz", "Dairy", "In Meat Market on the Back Wall", 3.49, 3.49, "", None),
    ("garlic-bread",     "509022",   "H-E-B Frozen Garlic Bread - Traditional", "16 oz", "Frozen", "Aisle 15", 2.38, 2.38, "", None),
    ("yellow-onions",    "449732",   "Fresh Yellow Onions", "3 lb bag", "Produce", "In Produce", 2.82, 2.82, "", None),
    # Meat-and-three (Thu)
    ("kevins-chicken",   "3272540",  "Kevin's Natural Foods Paleo Korean Style BBQ Chicken", "16 oz", "Meal Simple", "On the Right Edge of Meal Simple", 9.78, 9.78, "", None),
    ("broccoli-florets", "1742409",  "Fresh Steamable Broccoli Florets", "12 oz", "Produce", "In Produce on the Front Wall", 2.68, 2.68, "coupon", "Buy Meal Simple chicken (sold hot), get this free (exp 2026-11-03)"),
    ("jasmine-rice",     "2057455",  "H-E-B Thai Hom Mali Jasmine Rice", "2 lbs", "Pantry", "Aisle 7", 3.57, 3.57, "", None),
    ("chicken-breast",   "5244502",  "H-E-B Natural Boneless Chicken Breasts - Value Pack", "Avg. 4.9 lbs", "Meat", "In Meat Market on the Back Wall", 22.98, 14.65, "sale", None),
    # Weekly checklist staples
    ("eggs",             "2177042",  "H-E-B Grade AA Cage Free Large White Eggs", "18 ct", "Dairy", "In Dairy on the Right Wall", 4.29, 4.29, "", None),
    ("whole-milk",       "314130",   "H-E-B Whole Milk", "1 gal", "Dairy", "In Dairy on the Back Wall", 2.82, 2.82, "coupon", "Buy Huggies diapers, get this free (exp 2026-11-03)"),
    ("white-bread",      "395830",   "H-E-B Round Top Large White Enriched Sliced Bread", "20 oz", "Bakery", "Aisle 6", 2.48, 2.48, "coupon", "2 for $4 when you buy 2 (exp 2026-11-03)"),
    ("mandarins",        "10984012", "H-E-B Bella Mandarins (Cuties-style)", "3 lb bag", "Produce", "In Produce", 3.57, 2.97, "sale", None),
    ("oranges",          "10986009", "H-E-B Fresh Navel Oranges", "4 lb bag", "Produce", "In Produce", 5.22, 5.22, "", None),
    ("grapes-red",       "1562550",  "Fresh Red Seedless Grapes", "3 lb", "Produce", "In Produce on the Front Wall", 9.43, 9.43, "", None),
    ("grapes-green",     "1266309",  "Fresh White (Green) Seedless Grapes", "3 lb", "Produce", "In Produce on the Front Wall", 9.43, 9.43, "", None),
    ("strawberries",     "321286",   "Fresh Strawberries", "1 lb", "Produce", "In Produce on the Front Wall", 2.77, 2.77, "", None),
    ("blueberries",      "1146492",  "Fresh Blueberries", "11 oz", "Produce", "In Produce on the Front Wall", 4.19, 4.19, "", None),
    ("pears",            "320727",   "Fresh Bartlett Pears", "3 lbs", "Produce", "In Produce", 3.44, 3.44, "", None),
    ("pineapple",        "8630008",  "H-E-B Fresh Premium Pineapple", "Each", "Produce", "In Produce", 4.70, 4.70, "", None),
    ("watermelon-cut",   "1196328",  "H-E-B Fresh Cut Seedless Watermelon - Large", "Avg. 1.35 lbs", "Produce", "In Produce on the Front Wall", 6.02, 6.02, "", None),
    ("bananas",          "377497",   "Fresh Bunch of Bananas, 4-7 Bananas", "Avg. 2.4 lbs", "Produce", "In Produce", 1.18, 1.18, "", None),
    ("apples",           "12118021", "Rockit Fresh Miniature Apples", "3 lb", "Produce", "In Produce", 7.99, 7.99, "", None),
    ("butter",           "126467",   "H-E-B Sweet Cream Salted Butter Sticks", "4 ct", "Dairy", "In Dairy on the Right Wall", 3.98, 3.58, "pricecut", None),
    ("heb-cola",         "126644",   "H-E-B Original Cola 12 pk Cans", "12 oz cans", "Beverages", "Aisle 27", 5.00, 5.00, "coupon", "2 for $8 when you buy 2 (exp 2026-11-03)"),
    ("coffee",           "7421540",  "CAFE Olé by H-E-B Taste of DFW Medium Roast Ground Coffee", "12 oz", "Beverages", "Aisle 25", 8.98, 8.98, "coupon", "Buy 2, get free H-E-B Twisters cookies (exp 2026-11-03)"),
    ("protein-shakes",   "3766635",  "Slate High Protein Milk Shake - Classic Chocolate (20g)", "11 oz can", "Pantry", "Aisle 5", 3.28, 3.28, "", None),   # Brad: Slate 20g chocolate, sold single
    ("energy-drinks",    "1445080",  "Monster Energy Zero Sugar Energy Drink 4 pk Cans", "16 oz cans", "Beverages", "Aisle 27", 9.48, 9.48, "", None),
    ("celsius",          "1256960",  "Celsius Zero Sugar Sparkling Energy Drinks 4 pk - Wild Berry", "12 oz cans", "Beverages", "Aisle 4", 7.75, 7.75, "", None),
    ("celsius-12",       "5850098",  "Celsius Zero Sugar Variety Pack 12 pk", "12 oz cans", "Beverages", "Aisle 4", 22.54, 22.54, "", None),
    ("red-bull",         "1057226",  "Red Bull Original Energy Drink 4 pk Cans", "12 oz cans", "Beverages", "Aisle 27", 11.48, 11.48, "", None),
    ("bum-energy",       "15819032", "BUM Energy Zero Sugar Energy Drink - Cola", "12 oz can", "Beverages", "Aisle 5", 1.94, 1.94, "", None),
    ("bum-12",           "16106014", "BUM Energy Classic Soda Variety Pack 12 pk", "12 oz cans", "Beverages", "Aisle 4", 24.13, 24.13, "", None),
    ("red-bull-sf",      "1059685",  "Red Bull Sugar Free 4 pk Cans", "12 oz cans", "Beverages", "Aisle 27", 12.05, 12.05, "", None),
    ("monster-ultra-12", "4774005",  "Monster Energy Zero Ultra Sugar Free 12 pk", "16 oz cans", "Beverages", "Aisle 27", 25.18, 22.66, "pricecut", None),
    ("gatorade-zero",    "2764002",  "Gatorade Zero Sugar Lemon Lime 8 pk Bottles", "20 oz bottles", "Beverages", "Aisle 24", 7.32, 7.32, "", None),
    ("sweet-tea",        "1540546",  "H-E-B Texas-Style Brewed Sweet Iced Tea", "64 oz", "Beverages", "Aisle 24", 2.50, 2.50, "", None),
    ("diet-sweet-tea",   "1540553",  "H-E-B Diet Texas-Style Brewed Sweet Iced Tea", "64 oz", "Beverages", "Aisle 24", 2.50, 2.50, "", None),
    ("pure-leaf-unsweet","1870737",  "Pure Leaf Unsweetened Real Brewed Tea", "64 oz", "Beverages", "Aisle 24", 3.64, 3.64, "", None),
    ("diet-cola-cf",     "126850",   "H-E-B Caffeine-Free Diet Original Cola 12 pk Cans", "12 oz cans", "Beverages", "Aisle 27", 5.00, 5.00, "", None),
    ("diet-cola",        "127787",   "H-E-B Diet Original Cola 12 pk Cans", "12 oz cans", "Beverages", "Aisle 27", 5.00, 5.00, "", None),
    ("gatorade",         "149725",   "Gatorade Fruit Punch Thirst Quencher 8 pk Bottles", "20 oz bottles", "Beverages", "Aisle 24", 6.97, 6.97, "", None),   # flavor: Brad to confirm
    ("iced-tea",         "1540560",  "H-E-B Texas-Style Brewed Unsweet Iced Tea", "64 oz", "Beverages", "Aisle 24", 2.38, 2.38, "", None),
    ("goldfish",         "5808502",  "Goldfish Baked Cheddar Crackers - Family Size", "10 oz", "Snacks", "Aisle 11", 3.52, 3.52, "", None),
    ("string-cheese",    "1894949",  "H-E-B Low Moisture Part-Skim Mozzarella String Cheese, 12 ct", "10 oz", "Dairy", "In Meat Market on the Back Wall", 3.89, 3.89, "", None),
    ("peanut-butter",    "1581938",  "H-E-B Made in Texas Creamy Peanut Butter", "18 oz", "Pantry", "Aisle 6", 2.62, 2.62, "", None),
    ("cereal",           "2772004",  "H-E-B Honey & Nut Corn Flakes Cereal with Granola", "18 oz", "Pantry", "Aisle 9", 3.48, 3.48, "", None),
    ("tortilla-chips",   "1387370",  "H-E-B Restaurant-Style White Corn Tortilla Chips - Party Size", "18 oz", "Snacks", "Aisle 12", 3.98, 3.58, "pricecut", None),
    ("frozen-pizza",     "288583",   "H-E-B Uncured Pepperoni Rising Crust Frozen Pizza", "25.45 oz", "Frozen", "Aisle 14", 4.46, 4.46, "coupon", "$1 off any H-E-B frozen pizza (exp 2026-10-27)"),
    ("olive-oil",        "127074",   "H-E-B Extra Virgin Olive Oil", "17 oz", "Pantry", "Aisle 10", 8.28, 8.28, "", None),
]

# Fallback products, in order of preference after the main one in RAW. The app picks, each week:
# the first in-stock product that is on sale or price-cut; otherwise the first in-stock product.
# Brad: "we like Rockit apples; when those are out of stock or Honeycrisp are on sale, Honeycrisp."
ALTERNATES = {
    "blueberries": [
        ("1669538", "Fresh Jumbo Blueberries", "9.8 oz", "In Produce on the Front Wall", 5.62, 2.77, "sale", None),
    ],
    "mexican-blend": [
        ("947310", "H-E-B Mexican Style Shredded Cheese Blend", "16 oz", "In Meat Market on the Back Wall", 4.97, 3.99, "sale", None),
    ],
    "apples": [
        ("15810062", "H-E-B Fresh Honeycrisp Apples", "3 lb bag", "In Produce", 7.57, 3.28, "pricecut", None),
    ],
}

# Staples Brad only buys at H-E-B when they're on sale (Costco in bulk otherwise).
SALE_ONLY = {"energy-drinks", "celsius", "celsius-12", "red-bull", "red-bull-sf", "bum-energy", "bum-12", "monster-ultra-12"}

# Store-walk order for Main St, used by the Reminders export. Entrance is
# Produce, then around the perimeter, then numbered aisles. Adjust once Brad
# confirms his usual path.
SECTION_ORDER = ["Produce", "Bakery", "Meal Simple", "Meat", "Dairy", "Pantry", "Snacks", "Beverages", "Frozen", "Health"]

pantry = []
prices = {}   # keyed by H-E-B product id, so every candidate product has its own price record
def price_rec(aisle, list_price, price, flag, coupon):
    return {
        "price": price,
        "listPrice": list_price,
        "onSale": flag == "sale",
        "priceCut": flag == "pricecut",
        "coupon": coupon,
        "couponType": None if not coupon else ("combo" if coupon.startswith("Buy ") else "coupon"),
        "aisle": aisle,
        "available": True,
        "pulled": PULL_DATE,
    }
for key, pid, name, size, section, aisle, list_price, price, flag, coupon in RAW:
    products = [{"hebId": pid, "name": name, "size": size}]
    prices[pid] = price_rec(aisle, list_price, price, flag, coupon)
    for apid, aname, asize, aaisle, alist, aprice, aflag, acoupon in ALTERNATES.get(key, []):
        products.append({"hebId": apid, "name": aname, "size": asize})
        prices[apid] = price_rec(aaisle, alist, aprice, aflag, acoupon)
    item = {"key": key, "section": section, "products": products}
    if key in SALE_ONLY: item["saleOnly"] = True
    pantry.append(item)

meals = [
    {
        "id": "ground-beef-tacos",
        "name": "Ground Beef Tacos",
        "kind": "recipe",
        "theme": "tacos",
        "serves": 4,
        "items": [
            {"key": "ground-beef", "qty": 1},
            {"key": "taco-seasoning", "qty": 1},
            {"key": "flour-tortillas", "qty": 0.5},
            {"key": "shredded-cheddar", "qty": 1},
            {"key": "sour-cream", "qty": 0.5},
            {"key": "iceberg-lettuce", "qty": 0.5},
            {"key": "roma-tomatoes", "qty": 3},
            {"key": "salsa", "qty": 0.5},
        ],
        "notes": "Brown the beef with the seasoning packet. Everyone builds their own.",
    },
    {
        "id": "spaghetti-meat-sauce",
        "name": "Spaghetti with Meat Sauce",
        "kind": "recipe",
        "theme": "pasta",
        "serves": 4,
        "items": [
            {"key": "spaghetti", "qty": 1},
            {"key": "ground-beef", "qty": 1},
            {"key": "marinara", "qty": 2},
            {"key": "yellow-onions", "qty": 0.25},
            {"key": "parmesan", "qty": 0.25},
            {"key": "garlic-bread", "qty": 1},
        ],
        "notes": "Brown beef with half a diced onion, add both jars of sauce, simmer while the pasta cooks. Garlic bread in the oven.",
    },
    {
        "id": "kevins-chicken-broccoli-rice",
        "name": "Kevin's Korean BBQ Chicken, Broccoli, Rice",
        "kind": "heat-and-add",
        "theme": "meat-and-three",
        "serves": 4,
        "items": [
            {"key": "kevins-chicken", "qty": 1},
            {"key": "broccoli-florets", "qty": 1},
            {"key": "jasmine-rice", "qty": 0.25},
        ],
        "notes": "Chicken heats in a pan in 5 minutes. Broccoli steams in its bag. Rice in the cooker.",
    },
    {
        "id": "slate-shake",
        "name": "Slate chocolate shake",
        "kind": "breakfast",
        "theme": "breakfast",
        "serves": 1,
        "items": [
            {"key": "protein-shakes", "qty": 1},
        ],
        "notes": "One can. 20g protein.",
    },
    {
        "id": "frozen-pizza-night",
        "name": "Frozen Pizza Night",
        "kind": "repeat",
        "theme": "pizza",
        "serves": 4,
        "items": [
            {"key": "frozen-pizza", "qty": 2},
        ],
        "notes": "Two pizzas feeds four. Coupon is $1 off each in the HEB app.",
    },
]

out = Path(__file__).resolve().parent.parent / "data"
out.mkdir(exist_ok=True)
(out / "pantry.json").write_text(json.dumps({"store": STORE, "sectionOrder": SECTION_ORDER, "items": pantry}, indent=2) + "\n")
(out / "meals.json").write_text(json.dumps({"meals": meals}, indent=2) + "\n")
(out / "prices.json").write_text(json.dumps({"store": STORE, "pulled": PULL_DATE, "prices": prices}, indent=2) + "\n")
print(f"wrote {len(pantry)} pantry items, {len(meals)} meals, {len(prices)} prices")
