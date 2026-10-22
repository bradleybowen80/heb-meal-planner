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
    # Added Oct 22 from the nutrition guide list
    ("ground-beef-85"      , "312957", "H-E-B 100% Pure Ground Beef Round, 85% Lean", "1 lb", "Meat", "In Meat Market", 7.23, 7.23, "", None),
    ("ground-beef-90"      , "312958", "H-E-B 100% Pure Ground Beef Sirloin, 90% Lean", "1 lb", "Meat", "In Meat Market", 7.75, 7.75, "", None),
    ("ribeye"              , "371743", "H-E-B Boneless Beef Ribeye Steak, Thick Cut", "Avg. 1.0 lb", "Meat", "In Meat Market", 16.26, 16.26, "", None),
    ("ny-strip"            , "371801", "H-E-B Boneless Beef New York Strip Steak", "Avg. 0.65 lb", "Meat", "In Meat Market", 9.89, 9.89, "", None),
    ("sirloin"             , "371837", "H-E-B Beef Top Sirloin Steak Center Cut Value Pack", "Avg. 2.31 lbs", "Meat", "In Meat Market", 25.43, 25.43, "", None),
    ("flank-steak"         , "371450", "H-E-B Beef Flank Steak", "Avg. 1.21 lbs", "Meat", "In Meat Market", 13.96, 13.96, "", None),
    ("skirt-steak"         , "371434", "H-E-B Beef Inside Skirt Steak", "Avg. 0.87 lb", "Meat", "In Meat Market", 10.41, 10.41, "", None),
    ("pork-chops"          , "372693", "H-E-B Boneless Center Loin Pork Chops - Value Pack", "Avg. 1.64 lbs", "Meat", "In Meat Market", 6.35, 6.35, "", None),
    ("pork-tenderloin"     , "960257", "H-E-B Natural Pork Tenderloin", "Avg. 1.27 lbs", "Meat", "In Meat Market", 9.72, 9.72, "", None),
    ("pork-loin"           , "372757", "H-E-B Boneless Center Cut Pork Loin Roast", "Avg. 2.72 lbs", "Meat", "In Meat Market", 8.54, 8.54, "", None),
    ("pork-sausage"        , "126264", "H-E-B Premium Pork Breakfast Sausage - Regular", "32 oz", "Meat", "In Meat Market", 8.18, 8.18, "", None),
    ("thighs-boneless"     , "790544", "H-E-B Natural Boneless Skinless Chicken Thighs", "Avg. 2.0 lbs", "Meat", "In Meat Market", 9.42, 9.42, "", None),
    ("thighs-bonein"       , "684585", "H-E-B Natural Bone-in Skin-on Chicken Thighs", "Avg. 2.15 lbs", "Meat", "In Meat Market", 4.49, 4.49, "", None),
    ("ground-chicken"      , "938526", "H-E-B Ground Chicken Breast, 97% Lean", "Avg. 1.0 lb", "Meat", "In Meat Market", 3.91, 3.91, "", None),
    ("ground-turkey"       , "529848", "H-E-B Ground Turkey, 93% Lean", "16 oz", "Meat", "In Meat Market", 5.13, 5.13, "", None),
    ("salmon"              , "3608031", "H-E-B Responsibly Raised Fresh Atlantic Salmon Fillet", "per lb", "Seafood", "In Seafood on the Left Wall", 13.62, 13.62, "", None),
    ("catfish"             , "373281", "H-E-B Fish Market Fresh Catfish Fillet", "per lb", "Seafood", "In Seafood on the Left Wall", 8.68, 8.68, "", None),
    ("shrimp"              , "4725053", "H-E-B Wild Caught Frozen Peeled Large Texas Gulf Raw Shrimp", "1 lb", "Seafood", "In Seafood on the Left Wall", 8.37, 8.37, "", None),
    ("russet"              , "318997", "H-E-B Texas Roots Fresh Russet Potatoes", "5 lb bag", "Produce", "In Produce", 2.93, 2.93, "", None),
    ("gold-potatoes"       , "591301", "Fresh Gold Potatoes", "5 lb bag", "Produce", "In Produce", 6.55, 6.55, "", None),
    ("sweet-potato"        , "318978", "Fresh Sweet Potato", "Avg. 0.87 lb", "Produce", "In Produce", 0.9, 0.9, "", None),
    ("basmati"             , "2057447", "H-E-B Extra Long Grain Basmati Rice", "2 lbs", "Pantry", "Aisle 7", 3.8, 3.8, "", None),
    ("oats"                , "1527031", "H-E-B Old Fashioned Oats", "42 oz", "Pantry", "Aisle 9", 4.39, 4.39, "", None),
    ("sourdough"           , "2112928", "H-E-B Bakery Scratch Round Sourdough Bread", "22 oz", "Bakery", "On the Right Edge of Bakery", 4.7, 4.7, "", None),
    ("ezekiel"             , "178352", "Food For Life Ezekiel 4:9 Sprouted Grain Bread", "24 oz", "Frozen", "Aisle 15", 7.33, 7.33, "", None),
    ("siete"               , "2059978", "Siete Almond Flour Grain Free Tortillas", "8 ct", "Frozen", "Aisle 15", 8.25, 8.25, "", None),
    ("corn-tortillas"      , "3989007", "H-E-B Street Taco White Corn Tortillas", "24 ct", "Bakery", "Aisle 6", 1.76, 1.76, "", None),
    ("wheat-bread"         , "672611", "H-E-B 100% Whole Wheat Sliced Bread", "20 oz", "Bakery", "Aisle 6", 2.68, 2.38, "pricecut", None),
    ("burger-buns"         , "5635588", "H-E-B Bakery Brioche Hamburger Buns", "4 ct", "Bakery", "On the Right Edge of Bakery", 4.18, 4.18, "", None),
    ("penne"               , "1567265", "H-E-B Penne Rigate Pasta Noodles", "16 oz", "Pantry", "Aisle 7", 1.18, 1.18, "", None),
    ("rigatoni"            , "2151937", "H-E-B Rigatoni Pasta Noodles", "16 oz", "Pantry", "Aisle 7", 1.18, 1.18, "", None),
    ("butternut"           , "318866", "Fresh Butternut Squash", "Avg. 3.2 lbs", "Produce", "In Produce on the Left Wall", 4.92, 4.92, "", None),
    ("acorn-squash"        , "374723", "Fresh Acorn Squash", "Avg. 1.67 lbs", "Produce", "In Produce on the Left Wall", 2.59, 2.59, "", None),
    ("spaghetti-squash"    , "318864", "Fresh Spaghetti Squash", "Avg. 3.18 lbs", "Produce", "In Produce on the Left Wall", 4.93, 4.93, "", None),
    ("peas"                , "125656", "H-E-B Frozen Green Peas", "16 oz", "Frozen", "Aisle 17", 1.45, 1.45, "", None),
    ("corn"                , "126276", "H-E-B Frozen Super Sweet Corn", "16 oz", "Frozen", "Aisle 17", 1.55, 1.41, "pricecut", None),
    ("raspberries"         , "321289", "Fresh Raspberries", "6 oz", "Produce", "In Produce on the Front Wall", 2.7, 2.7, "", None),
    ("blackberries"        , "321290", "Fresh Blackberries", "6 oz", "Produce", "In Produce on the Front Wall", 3.01, 3.01, "", None),
    ("dates"               , "1623373", "Natural Delights Fresh Pitted Medjool Dates", "12 oz", "Produce", "In Produce", 6.28, 6.28, "", None),
    ("peaches"             , "320978", "H-E-B Yellow Peach", "Avg. 0.53 lb", "Produce", "In Produce", 1.66, 1.66, "", None),
    ("honey"               , "1626659", "H-E-B Texas Wildflower Honey", "12 oz", "Pantry", "Aisle 6", 5.12, 5.12, "", None),
    ("yogurt"              , "313850", "Dannon Whole Milk Plain Yogurt", "32 oz", "Dairy", "In Dairy on the Back Wall", 3.74, 3.74, "", None),
    ("kerrygold"           , "1507870", "Kerrygold Grass-Fed Pure Irish Butter", "8 oz", "Dairy", "In Dairy on the Right Wall", 5.84, 5.84, "", None),
    ("ghee"                , "1928167", "4th & Heart Ghee Clarified Butter - Original", "9 oz", "Pantry", "Aisle 10", 12.05, 12.05, "", None),
    ("tallow"              , "15798526", "Real Good Foods Co. Angus Beef Tallow Cooking Oil", "14 oz", "Pantry", "Aisle 10", 8.37, 8.37, "", None),
    ("avocado-oil"         , "3677516", "H-E-B Avocado Oil", "51 oz", "Pantry", "Aisle 10", 24.65, 24.65, "", None),
    ("coconut-oil"         , "1936524", "H-E-B Organics Refined Coconut Oil", "56 oz", "Pantry", "Aisle 10", 14.31, 14.31, "", None),
    ("avocados"            , "6180070", "H-E-B Fresh Hass Avocados", "5 ct", "Produce", "In Produce", 7.32, 6.27, "pricecut", None),
    ("monterey-jack"       , "126021", "H-E-B Monterey Jack Shredded Cheese", "8 oz", "Dairy", "In Meat Market on the Back Wall", 3.13, 3.13, "", None),
    ("mozzarella"          , "1638093", "H-E-B Low Moisture Whole Mozzarella Shredded Cheese", "8 oz", "Dairy", "In Meat Market on the Back Wall", 3.13, 3.13, "", None),
    ("bacon"               , "1475819", "H-E-B Original Bacon", "12 oz", "Meat", "In Meat Market", 4.61, 4.61, "", None),
    ("heavy-cream"         , "676456", "H-E-B Heavy Whipping Cream", "32 oz", "Dairy", "In Dairy on the Back Wall", 4.98, 4.98, "", None),
    ("half-and-half"       , "583960", "H-E-B Half & Half", "32 oz", "Dairy", "In Dairy on the Back Wall", 2.6, 2.6, "", None),
    ("pistachios"          , "15341015", "Wonderful Unsalted No Shells Pistachios", "6 oz", "Snacks", "Aisle 11", 6.81, 6.81, "", None),
    ("walnuts"             , "1627673", "H-E-B Walnut Halves & Pieces", "11 oz", "Pantry", "Aisle 4", 5.75, 5.75, "", None),
    ("macadamias"          , "13948511", "H-E-B Macadamia Nuts", "6 oz", "Snacks", "Aisle 11", 5.23, 5.23, "", None),
    ("raos"                , "540107", "Rao's Homemade Marinara Sauce", "24 oz", "Pantry", "Aisle 7", 7.9, 7.9, "", None),
    ("cauliflower"         , "319058", "Fresh Cauliflower", "Each", "Produce", "In Produce on the Left Wall", 3.65, 3.65, "", None),
    ("riced-cauliflower"   , "2233669", "H-E-B Frozen Riced Cauliflower", "12 oz", "Frozen", "Aisle 17", 2.35, 2.35, "", None),
    ("asparagus"           , "319073", "Fresh Asparagus Bunch", "Avg. 1.1 lbs", "Produce", "In Produce on the Left Wall", 4.93, 4.93, "", None),
    ("brussels"            , "605648", "Fresh Brussels Sprouts", "1 lb bag", "Produce", "In Produce on the Left Wall", 3.12, 3.12, "", None),
    ("green-beans"         , "374816", "Fresh Green Beans", "Avg. 1.5 lbs", "Produce", "In Produce on the Left Wall", 2.81, 2.81, "", None),
    ("mushrooms"           , "319809", "Fresh Whole White Mushrooms", "8 oz", "Produce", "In Produce on the Left Wall", 1.88, 1.88, "", None),
    ("cremini"             , "481068", "Fresh Sliced Baby Bella Mushrooms", "8 oz", "Produce", "In Produce on the Left Wall", 2.47, 2.47, "", None),
    ("white-onions"        , "1286065", "Fresh White Onions", "3 lb bag", "Produce", "In Produce", 3.66, 3.66, "", None),
    ("red-onion"           , "325170", "Fresh Red Onion", "Avg. 1.0 lb", "Produce", "In Produce", 1.32, 1.32, "", None),
    ("green-onions"        , "374854", "Fresh Green Onions", "Each", "Produce", "In Produce on the Left Wall", 0.72, 0.72, "", None),
    ("bell-peppers"        , "4915011", "H-E-B Fresh Sunrise Bell Peppers (red, yellow, orange)", "3 ct", "Produce", "In Produce", 3.86, 3.86, "", None),
    ("green-bell-peppers"  , "1943983", "Fresh Green Bell Peppers", "3 ct", "Produce", "In Produce", 2.27, 2.27, "", None),
    ("spinach"             , "984624", "H-E-B Fresh Baby Spinach", "6 oz", "Produce", "In Produce on the Left Wall", 2.29, 2.29, "", None),
    ("romaine"             , "319730", "Fresh Romaine Lettuce Hearts", "3 pk", "Produce", "In Produce on the Left Wall", 3.81, 3.81, "", None),
    ("arugula"             , "2956624", "B&W Fresh Baby Arugula", "4 oz", "Produce", "In Produce on the Left Wall", 2.08, 2.08, "", None),
    ("kale"                , "1738190", "H-E-B Texas Roots Fresh Kale Greens", "16 oz", "Produce", "In Produce on the Front Wall", 3.55, 3.55, "", None),
    ("celery"              , "325173", "Fresh Celery Stalk", "Each", "Produce", "In Produce on the Left Wall", 2.07, 2.07, "", None),
    ("baby-carrots"        , "4833574", "H-E-B Fresh Baby Carrots", "1 lb", "Produce", "In Produce on the Front Wall", 1.39, 1.23, "pricecut", None),
    ("radishes"            , "11439511", "H-E-B Fresh Red Radishes", "1 lb bag", "Produce", "In Produce on the Front Wall", 2.6, 2.6, "", None),
    ("green-cabbage"       , "374791", "Fresh Green Cabbage", "Avg. 2.75 lbs", "Produce", "In Produce on the Left Wall", 2.56, 2.56, "", None),
    ("red-cabbage"         , "374790", "Fresh Red Cabbage", "Avg. 2.38 lbs", "Produce", "In Produce on the Left Wall", 2.45, 2.45, "", None),
    ("palmini"             , "6631520", "Palmini Hearts of Palm Angel Hair", "12 oz", "Pantry", "Aisle 5", 4.18, 4.18, "", None),
    ("cilantro"            , "325175", "Fresh Cilantro", "1 bunch", "Produce", "In Produce on the Left Wall", 0.53, 0.53, "", None),
    ("parsley"             , "319480", "Fresh Italian Parsley", "Each", "Produce", "In Produce on the Left Wall", 1.01, 1.01, "", None),
    ("basil"               , "1926156", "Fresh Aqua-dome Basil", "Each", "Produce", "In Produce on the Front Wall", 2.81, 2.81, "", None),
    ("dill"                , "16845012", "Goodness Gardens Fresh Dill", "0.5 oz", "Produce", "In Produce on the Front Wall", 1.87, 1.87, "", None),
    ("sparkling-water"     , "909594", "H-E-B Unsweetened Unflavored Sparkling Water 12 pk", "12 oz cans", "Beverages", "Aisle 24", 5.23, 4.7, "pricecut", None),
    ("yellow-mustard"      , "1762752", "H-E-B Yellow Mustard", "14 oz", "Pantry", "Aisle 6", 1.76, 1.76, "", None),
    ("brown-mustard"       , "1762750", "H-E-B Spicy Brown Mustard", "12 oz", "Pantry", "Aisle 6", 1.86, 1.86, "", None),
    ("cucumber"            , "319432", "Fresh Cucumber", "Each", "Produce", "In Produce on the Left Wall", 0.53, 0.53, "", None),
    ("english-cucumber"    , "319426", "Fresh Seedless (English) Cucumber", "Each", "Produce", "In Produce on the Left Wall", 1.03, 1.03, "", None),
    ("mini-cucumbers"      , "4915012", "H-E-B Fresh Mini Seedless Cucumbers", "16 oz", "Produce", "In Produce on the Left Wall", 2.18, 2.18, "", None),
    ("jalapenos"           , "374686", "Fresh Jalapeño Pepper", "Avg. 0.165 lb", "Produce", "In Produce", 0.17, 0.17, "", None),
    ("serranos"            , "374707", "Fresh Serrano Pepper", "Avg. 0.03 lb", "Produce", "In Produce", 0.08, 0.08, "", None),
    ("red-bell"            , "325164", "Fresh Red Bell Pepper", "Each", "Produce", "In Produce", 1.55, 1.55, "", None),
    ("zucchini"            , "374744", "Fresh Zucchini Squash", "Avg. 0.45 lb", "Produce", "In Produce on the Left Wall", 0.61, 0.61, "", None),
    ("yellow-squash"       , "374745", "Fresh Yellow Squash", "Avg. 0.45 lb", "Produce", "In Produce on the Left Wall", 0.65, 0.65, "", None),
    ("lemons"              , "5695503", "H-E-B Fresh Lemons", "2 lb bag", "Produce", "In Produce", 4.12, 4.12, "", None),
    ("limes"               , "442356", "Fresh Lime", "Each", "Produce", "In Produce", 0.21, 0.21, "", None),
    ("acv"                 , "184255", "Bragg Organic Apple Cider Vinegar with The Mother", "16 oz", "Pantry", "Aisle 7", 4.7, 4.7, "", None),
    ("red-wine-vinegar"    , "1778967", "H-E-B Red Wine Vinegar", "16.9 oz", "Pantry", "Aisle 7", 3.07, 3.07, "", None),
    ("white-vinegar"       , "28184", "Heinz Distilled White Vinegar", "16 oz", "Pantry", "Aisle 7", 1.76, 1.76, "", None),
    ("franks"              , "130312", "Frank's RedHot Original Cayenne Pepper Hot Sauce", "12 fl oz", "Pantry", "Aisle 6", 4.17, 3.72, "pricecut", None),
    ("tabasco"             , "22772", "Tabasco Original Red Pepper Sauce", "5 oz", "Pantry", "Aisle 6", 4.06, 4.06, "", None),
    ("cholula"             , "146593", "Cholula Original Hot Sauce", "5 oz", "Pantry", "Aisle 6", 4.12, 3.71, "pricecut", None),
    ("kosher-salt"         , "88966", "Morton Coarse Kosher Salt", "3 lb", "Pantry", "Aisle 10", 3.68, 3.68, "", None),
    ("sea-salt"            , "1165092", "Morton Fine Sea Salt", "17.6 oz", "Pantry", "Aisle 10", 3.13, 3.13, "", None),
    ("black-pepper"        , "123909", "H-E-B Pure Ground Black Pepper", "2 oz", "Pantry", "Aisle 10", 2.39, 2.39, "", None),
    ("garlic-powder"       , "1627075", "H-E-B California Garlic Powder", "2.35 oz", "Pantry", "Aisle 10", 2.71, 2.71, "", None),
    ("onion-powder"        , "8728043", "H-E-B Onion Powder", "2.4 oz", "Pantry", "Aisle 10", 3.02, 2.71, "pricecut", None),
    ("cumin"               , "1627063", "H-E-B Ground Cumin", "1.8 oz", "Pantry", "Aisle 10", 2.6, 2.6, "", None),
    ("smoked-paprika"      , "8709004", "H-E-B Smoked Paprika", "0.7 oz", "Pantry", "Aisle 10", 2.29, 2.29, "", None),
    ("chili-powder"        , "2768055", "McCormick Chili Powder", "2.5 oz", "Pantry", "Aisle 10", 2.37, 2.37, "", None),
    ("oregano"             , "1627072", "H-E-B Oregano Leaves", "0.5 oz", "Pantry", "Aisle 10", 2.29, 2.29, "", None),
    ("turmeric"            , "8709002", "H-E-B Ground Turmeric", "1 oz", "Pantry", "Aisle 10", 2.29, 2.29, "", None),
    ("green-tea"           , "1644005", "H-E-B Green Tea Bags", "40 ct", "Beverages", "Aisle 25", 4.45, 4.45, "", None),
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
SECTION_ORDER = ["Produce", "Bakery", "Meal Simple", "Meat", "Seafood", "Dairy", "Pantry", "Snacks", "Beverages", "Frozen", "Health"]

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
