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
    ("bananas",          "377497",   "Fresh Bunch of Bananas, 4-7 Bananas", "Avg. 2.4 lbs", "Produce", "In Produce", 1.18, 1.18, "", None),
    ("gala-apples",      "10540517", "H-E-B Fresh Gala Apples", "3 lb bag", "Produce", "In Produce", 2.18, 2.18, "", None),
    ("butter",           "126467",   "H-E-B Sweet Cream Salted Butter Sticks", "4 ct", "Dairy", "In Dairy on the Right Wall", 3.98, 3.58, "pricecut", None),
    ("heb-cola",         "126644",   "H-E-B Original Cola 12 pk Cans", "12 oz cans", "Beverages", "Aisle 27", 5.00, 5.00, "coupon", "2 for $8 when you buy 2 (exp 2026-11-03)"),
    ("coffee",           "7421540",  "CAFE Olé by H-E-B Taste of DFW Medium Roast Ground Coffee", "12 oz", "Beverages", "Aisle 25", 8.98, 8.98, "coupon", "Buy 2, get free H-E-B Twisters cookies (exp 2026-11-03)"),
    ("protein-shakes",   "1883112",  "Premier Protein 30g Protein Shakes 4 pk Bottles - Chocolate", "11 oz bottles", "Health", "Aisle 40", 9.58, 9.58, "", None),
    ("energy-drinks",    "1445080",  "Monster Energy Zero Sugar Energy Drink 4 pk Cans", "16 oz cans", "Beverages", "Aisle 27", 9.48, 9.48, "", None),
    ("goldfish",         "5808502",  "Goldfish Baked Cheddar Crackers - Family Size", "10 oz", "Snacks", "Aisle 11", 3.52, 3.52, "", None),
    ("string-cheese",    "1894949",  "H-E-B Low Moisture Part-Skim Mozzarella String Cheese, 12 ct", "10 oz", "Dairy", "In Meat Market on the Back Wall", 3.89, 3.89, "", None),
    ("peanut-butter",    "1581938",  "H-E-B Made in Texas Creamy Peanut Butter", "18 oz", "Pantry", "Aisle 6", 2.62, 2.62, "", None),
    ("cereal",           "2772004",  "H-E-B Honey & Nut Corn Flakes Cereal with Granola", "18 oz", "Pantry", "Aisle 9", 3.48, 3.48, "", None),
    ("tortilla-chips",   "1387370",  "H-E-B Restaurant-Style White Corn Tortilla Chips - Party Size", "18 oz", "Snacks", "Aisle 12", 3.98, 3.58, "pricecut", None),
    ("frozen-pizza",     "288583",   "H-E-B Uncured Pepperoni Rising Crust Frozen Pizza", "25.45 oz", "Frozen", "Aisle 14", 4.46, 4.46, "coupon", "$1 off any H-E-B frozen pizza (exp 2026-10-27)"),
    ("olive-oil",        "127074",   "H-E-B Extra Virgin Olive Oil", "17 oz", "Pantry", "Aisle 10", 8.28, 8.28, "", None),
]

# Store-walk order for Main St, used by the Reminders export. Entrance is
# Produce, then around the perimeter, then numbered aisles. Adjust once Brad
# confirms his usual path.
SECTION_ORDER = ["Produce", "Bakery", "Meal Simple", "Meat", "Dairy", "Pantry", "Snacks", "Beverages", "Frozen", "Health"]

pantry = []
prices = {}
for key, pid, name, size, section, aisle, list_price, price, flag, coupon in RAW:
    pantry.append({
        "key": key,
        "hebId": pid,
        "name": name,
        "size": size,
        "section": section,
        "unit": "package" if "Avg." not in size else "pack (sold by weight)",
    })
    prices[key] = {
        "hebId": pid,
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
