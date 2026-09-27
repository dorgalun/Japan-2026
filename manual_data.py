# -*- coding: utf-8 -*-
"""Hand-curated data that the sheet does not contain."""

# Hebrew notes in the sheet -> English
HEBREW_TR = {
    "מוזיאון האמנות המטרופוליני של טוקיו": "Tokyo Metropolitan Art Museum",
    "נפתח רק כמה שבועות לפני כל פעם": "Opens only a few weeks ahead each time",
    "מזמינים בטלפון שבוע מראש": "Book by phone, 1 week ahead",
    "צריך להזמין מקום בטלפון": "Reserve by phone",
    "חודש בדיוק מראש": "Opens exactly 1 month ahead",
    "נפתח כל חודש לפני ב-20 בחודש": "Opens on the 20th of the previous month"
}

# Places the name-matcher could not find in My Maps (looked up via Google Places)
MANUAL_GEO = {
    'Lunch - Ichiran ramen': (35.6689505, 139.7592269, None),
    'Coffee - Glitch Coffee': (35.6937428, 139.7613047, None),
    'Oi Racecourse Flea Market': (35.5949798, 139.7430414, None),
    'Dinner - Joumon Shibuya': (35.6589673, 139.6965946, None),
    'Coffee - leaves': (35.7027051, 139.7978326, None),
    'Senso-Ji temple and the stalls that leads to it': (35.7147651, 139.7966553, None),
    'Open air museum Hakone': (35.2451601, 139.0507271, None),
    'Hakone Shrine': (35.2048263, 139.0253782, None),
    'Hakone Ropeway Ōwakudani Station': (35.2444656, 139.0198459, None),
    'Matcha making workshop': (34.9951908, 135.7801718, 'Kyoto Tea Ceremony & Matcha Making, Kiyomizu branch'),
    'Otagi Nenbutsuji - stone sculptures temple': (35.0311428, 135.6615546, None),
    'Manyo Botanical Gardens': (34.6824519, 135.8442139, None),
    'If we have time - Osaka Castle': (34.6872571, 135.5258546, None),
    'Universal Studios Day': (34.6656768, 135.4323185, None),
    "Dinner with Alon and Na'ama - PST pizza / Savoy pizza": (35.655648, 139.74437, 'PST Higashi Azabu (or Savoy Azabujuban nearby)'),
    'Bar - THESE': (35.6609632, 139.7222335, None),
    'Coffee - MMC': (35.6970046, 139.8026522, None),
    'Dinner - MAZ': (35.6794272, 139.7376625, None),
    'Dinner - やき肉玄趣 江洲\nspecial Yakiniku': (35.0311807, 135.7805577, None),
    'Shitamachi Museum': (35.7102379, 139.7727531, None),
    'National Museum of Nature and Science': (35.7164273, 139.7763336, None),
    'If we have time - Zoo': (35.7164476, 139.7725826, 'Ueno Zoo — closed Mondays'),
    'ABOUT LIFE COFFEE BREWERS': (35.6567022, 139.6958093, None),
    'Option for afternoon coffee - THE ROASTERY BY NOZY COFFEE': (35.6655724, 139.7047658, None),
    'KOFFEE MAMEYA': (35.668368, 139.710888, None),
    "Dinner with Alon and Na'ama - PST pizza": (35.655648, 139.74437, None),
    'Tokyo Omotesando: Authentic Chopstick-Making Workshop': (35.6668055, 139.7114154, 'Ginza Natsuno chopstick studio, Omotesando'),
}

# Real travel time for specific legs (minutes), keyed by (date, activity)
SPECIFIC_DURATION = {
    ('13.10.26', 'RomanceCar to Hakone (buy bento at the train station)'): 110,
    ('14.10.26', 'Shinkensen to Kyoto'): 140,
    ('18.10.26', 'Train to Osaka'): 45,
    ('21.10.26', 'Shinkensen to Tokyo'): 165,
    ('13.10.26', 'Shinkensen to Kyoto (buy bento at the train station)'): 105,
    ('13.10.26', 'Arriving Hakone'): 15,
    ('18.10.26', 'Trip to Nara from kyoto'): 50,
    ('21.10.26', 'Off to tokyo'): 165,
    ('26.10.26', 'Off to Narita Airport'): 90,
    ('09.10.26', 'Arriving to Tokyo, Narita Airport'): 45,
}

# Travel time that happens BEFORE the row (single "Arriving X" rows with
# no separate departure row), so the shown time is the true arrival.
SPECIFIC_PRE_BUFFER = {
}
