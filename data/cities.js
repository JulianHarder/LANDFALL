// Eigene Städte-Knoten und Regeln für die vereinfachten Landstrecken.
// Eine Stadt wird per Luftlinie (gestrichelt) mit den (höchstens `k`) nächsten Landepunkten
// verbunden, die in einem der Länder aus `countries` liegen (= auf dem Landweg
// erreichbar) und höchstens `radius` km entfernt sind. Landepunkte desselben Landes
// im Abstand von höchstens `hubKm` gelten untereinander als landverbunden.
window.CITIES = [
  { id: "new-york",    name: "New York",   lon: -74.006, lat: 40.713, countries: ["United States"] },
  { id: "los-angeles", name: "Los Angeles", lon: -118.244, lat: 34.052, countries: ["United States"] },
  { id: "london",      name: "London",     lon: -0.128,  lat: 51.507, countries: ["United Kingdom"], radius: 450 },
  { id: "frankfurt",   name: "Frankfurt",  lon: 8.682,   lat: 50.110, countries: ["Germany", "Netherlands", "Belgium", "Denmark", "France", "Spain", "Italy", "Monaco", "Portugal"], radius: 1000 },
  { id: "marseille",   name: "Marseille",  lon: 5.370,   lat: 43.296, countries: ["France", "Spain", "Italy", "Monaco"] },
  { id: "alexandria",  name: "Alexandria", lon: 29.919,  lat: 31.200, countries: ["Egypt"], radius: 450 },
  { id: "dubai",       name: "Dubai",      lon: 55.271,  lat: 25.205, countries: ["United Arab Emirates", "Oman"] },
  { id: "mumbai",      name: "Mumbai",     lon: 72.878,  lat: 19.076, countries: ["India"], radius: 150 },
  { id: "singapore",   name: "Singapur",   lon: 103.820, lat: 1.352,  countries: ["Singapore", "Malaysia", "Thailand"] },
  { id: "hong-kong",   name: "Hongkong",   lon: 114.169, lat: 22.320, countries: ["China", "Vietnam"] },
  { id: "shanghai",    name: "Shanghai",   lon: 121.474, lat: 31.230, countries: ["China"] },
  { id: "tokyo",       name: "Tokio",      lon: 139.692, lat: 35.690, countries: ["Japan"], radius: 900, k: 80 }, // 900: erreicht Fukuoka/Kitakyushu (KJCN nach Korea)
  { id: "lagos",       name: "Lagos",      lon: 3.379,   lat: 6.524,  countries: ["Nigeria", "Togo", "Ghana"], radius: 600 },
  { id: "cape-town",   name: "Kapstadt",   lon: 18.424,  lat: -33.925, countries: ["South Africa", "Namibia"], radius: 700 },
  { id: "sydney",      name: "Sydney",     lon: 151.209, lat: -33.869, countries: ["Australia"] },
  { id: "sao-paulo",   name: "São Paulo",  lon: -46.633, lat: -23.551, countries: ["Brazil"] },
  { id: "nairobi",     name: "Nairobi",    lon: 36.822,  lat: -1.292, countries: ["Kenya"], radius: 500 },
  { id: "abidjan", name: "Abidjan", lon: -4.02, lat: 5.36, countries: ["Côte d'Ivoire", "Ghana"], radius: 500 },
  { id: "accra", name: "Accra", lon: -0.19, lat: 5.6, countries: ["Ghana", "Togo"], radius: 400 },
  { id: "algier", name: "Algier", lon: 3.06, lat: 36.75, countries: ["Algeria"] },
  { id: "amsterdam", name: "Amsterdam", lon: 4.9, lat: 52.37, countries: ["Netherlands", "Belgium"], radius: 200 },
  { id: "athen", name: "Athen", lon: 23.73, lat: 37.98, countries: ["Greece"] },
  { id: "auckland", name: "Auckland", lon: 174.76, lat: -36.85, countries: ["New Zealand"] },
  { id: "bangkok", name: "Bangkok", lon: 100.5, lat: 13.75, countries: ["Thailand"], radius: 500 },
  { id: "barcelona", name: "Barcelona", lon: 2.17, lat: 41.39, countries: ["Spain", "France"] },
  { id: "beirut", name: "Beirut", lon: 35.5, lat: 33.89, countries: ["Lebanon"], radius: 200 },
  { id: "berlin", name: "Berlin", lon: 13.4, lat: 52.52, countries: ["Germany", "Denmark", "Poland"], radius: 500 },
  { id: "bogota", name: "Bogotá", lon: -74.07, lat: 4.71, countries: ["Colombia"], radius: 900 },
  { id: "brisbane", name: "Brisbane", lon: 153.03, lat: -27.47, countries: ["Australia"] },
  { id: "buenos-aires", name: "Buenos Aires", lon: -58.38, lat: -34.6, countries: ["Argentina", "Uruguay"], radius: 400 },
  { id: "caracas", name: "Caracas", lon: -66.9, lat: 10.48, countries: ["Venezuela"] },
  { id: "casablanca", name: "Casablanca", lon: -7.59, lat: 33.57, countries: ["Morocco"], radius: 400 },
  { id: "chennai", name: "Chennai", lon: 80.27, lat: 13.08, countries: ["India"], radius: 550 }, // 550: erreicht Tuticorin (Bharat Lanka nach Sri Lanka)
  { id: "colombo", name: "Colombo", lon: 79.86, lat: 6.93, countries: ["Sri Lanka"], radius: 200 },
  { id: "dakar", name: "Dakar", lon: -17.47, lat: 14.69, countries: ["Senegal", "Gambia", "Mauritania"] },
  { id: "dar-es-salaam", name: "Daressalam", lon: 39.28, lat: -6.79, countries: ["Tanzania"] },
  { id: "dhaka", name: "Dhaka", lon: 90.41, lat: 23.81, countries: ["Bangladesh"], radius: 400 },
  { id: "dschibuti", name: "Dschibuti", lon: 43.15, lat: 11.59, countries: ["Djibouti"], radius: 200 },
  { id: "dschidda", name: "Dschidda", lon: 39.17, lat: 21.54, countries: ["Saudi Arabia"], radius: 200 },
  { id: "doha", name: "Doha", lon: 51.53, lat: 25.29, countries: ["Qatar", "Bahrain"] },
  { id: "dublin", name: "Dublin", lon: -6.26, lat: 53.35, countries: ["Ireland"] },
  { id: "fortaleza", name: "Fortaleza", lon: -38.52, lat: -3.73, countries: ["Brazil"], radius: 200 },
  { id: "guam", name: "Guam", lon: 144.79, lat: 13.44, countries: ["Guam"], radius: 100 },
  { id: "halifax", name: "Halifax", lon: -63.57, lat: 44.65, countries: ["Canada"] },
  { id: "hanoi", name: "Hanoi", lon: 105.85, lat: 21.03, countries: ["Vietnam"], radius: 700 },
  { id: "havanna", name: "Havanna", lon: -82.37, lat: 23.11, countries: ["Cuba"], radius: 800 }, // 800: erreicht Santiago/Siboney (ALBA-1), nicht die US-Basis Guantánamo (825 km)
  { id: "helsinki", name: "Helsinki", lon: 24.94, lat: 60.17, countries: ["Finland", "Estonia"] },
  { id: "ho-chi-minh-stadt", name: "Ho-Chi-Minh-Stadt", lon: 106.63, lat: 10.82, countries: ["Vietnam", "Cambodia"], radius: 400 },
  { id: "honolulu", name: "Honolulu", lon: -157.86, lat: 21.31, countries: ["United States"] },
  { id: "istanbul", name: "Istanbul", lon: 28.98, lat: 41.01, countries: ["Turkey", "Bulgaria", "Greece"], radius: 400 },
  { id: "jakarta", name: "Jakarta", lon: 106.85, lat: -6.21, countries: ["Indonesia"] },
  { id: "johannesburg", name: "Johannesburg", lon: 28.05, lat: -26.2, countries: ["South Africa", "Mozambique"], radius: 900 },
  { id: "kairo", name: "Kairo", lon: 31.24, lat: 30.04, countries: ["Egypt"], radius: 450 },
  { id: "karatschi", name: "Karatschi", lon: 67.0, lat: 24.86, countries: ["Pakistan"], radius: 200 },
  { id: "kingston", name: "Kingston", lon: -76.79, lat: 17.97, countries: ["Jamaica"], radius: 200 },
  { id: "kopenhagen", name: "Kopenhagen", lon: 12.57, lat: 55.68, countries: ["Denmark", "Sweden"] },
  { id: "kuala-lumpur", name: "Kuala Lumpur", lon: 101.69, lat: 3.14, countries: ["Malaysia", "Singapore"], radius: 400 },
  { id: "kuwait-stadt", name: "Kuwait-Stadt", lon: 47.98, lat: 29.38, countries: ["Kuwait"], radius: 200 },
  { id: "lima", name: "Lima", lon: -77.04, lat: -12.05, countries: ["Peru"] },
  { id: "lissabon", name: "Lissabon", lon: -9.14, lat: 38.72, countries: ["Portugal"] },
  { id: "luanda", name: "Luanda", lon: 13.23, lat: -8.84, countries: ["Angola"], radius: 200 },
  { id: "madrid", name: "Madrid", lon: -3.7, lat: 40.42, countries: ["Spain", "Portugal"], radius: 700 },
  { id: "male", name: "Malé", lon: 73.51, lat: 4.18, countries: ["Maldives"], radius: 200 },
  { id: "mailand", name: "Mailand", lon: 9.19, lat: 45.46, countries: ["Italy", "France"], radius: 400 },
  { id: "manila", name: "Manila", lon: 120.98, lat: 14.6, countries: ["Philippines"] },
  { id: "maputo", name: "Maputo", lon: 32.57, lat: -25.97, countries: ["Mozambique", "South Africa"] },
  { id: "melbourne", name: "Melbourne", lon: 144.96, lat: -37.81, countries: ["Australia"] },
  { id: "mexiko-stadt", name: "Mexiko-Stadt", lon: -99.13, lat: 19.43, countries: ["Mexico"], radius: 1600 },
  { id: "miami", name: "Miami", lon: -80.19, lat: 25.76, countries: ["United States"] },
  { id: "mogadischu", name: "Mogadischu", lon: 45.34, lat: 2.05, countries: ["Somalia"], radius: 200 },
  { id: "muskat", name: "Muskat", lon: 58.41, lat: 23.59, countries: ["Oman"] },
  { id: "neu-delhi", name: "Neu-Delhi", lon: 77.21, lat: 28.61, countries: ["India"], radius: 1400 },
  { id: "noumea", name: "Nouméa", lon: 166.46, lat: -22.27, countries: ["New Caledonia"], radius: 100 },
  { id: "oslo", name: "Oslo", lon: 10.75, lat: 59.91, countries: ["Norway", "Sweden"] },
  { id: "panama-stadt", name: "Panama-Stadt", lon: -79.52, lat: 8.98, countries: ["Panama"] },
  { id: "papeete", name: "Papeete", lon: -149.57, lat: -17.54, countries: ["French Polynesia"], radius: 100 },
  { id: "paris", name: "Paris", lon: 2.35, lat: 48.86, countries: ["France", "Belgium"], radius: 500 },
  { id: "peking", name: "Peking", lon: 116.41, lat: 39.9, countries: ["China"], radius: 700 },
  { id: "perth", name: "Perth", lon: 115.86, lat: -31.95, countries: ["Australia"] },
  { id: "port-louis", name: "Port Louis", lon: 57.5, lat: -20.16, countries: ["Mauritius"], radius: 200 },
  { id: "port-moresby", name: "Port Moresby", lon: 147.18, lat: -9.44, countries: ["Papua New Guinea"] },
  { id: "reykjavik", name: "Reykjavík", lon: -21.94, lat: 64.15, countries: ["Iceland"], radius: 200 },
  { id: "rio-de-janeiro", name: "Rio de Janeiro", lon: -43.17, lat: -22.91, countries: ["Brazil"] },
  { id: "riad", name: "Riad", lon: 46.68, lat: 24.71, countries: ["Saudi Arabia", "Bahrain", "Qatar"], radius: 700 },
  { id: "rom", name: "Rom", lon: 12.5, lat: 41.9, countries: ["Italy"] },
  { id: "san-francisco", name: "San Francisco", lon: -122.42, lat: 37.77, countries: ["United States"], radius: 450 },
  { id: "sankt-petersburg", name: "Sankt Petersburg", lon: 30.34, lat: 59.93, countries: ["Russia", "Finland", "Estonia"] },
  { id: "santiago", name: "Santiago de Chile", lon: -70.67, lat: -33.45, countries: ["Chile"] },
  { id: "seattle", name: "Seattle", lon: -122.33, lat: 47.61, countries: ["United States", "Canada"] },
  { id: "seoul", name: "Seoul", lon: 126.98, lat: 37.57, countries: ["South Korea"], radius: 350 }, // 350: erreicht Busan (KJCN nach Japan)
  { id: "stockholm", name: "Stockholm", lon: 18.07, lat: 59.33, countries: ["Sweden"] },
  { id: "suva", name: "Suva", lon: 178.44, lat: -18.14, countries: ["Fiji"], radius: 200 },
  { id: "taipeh", name: "Taipeh", lon: 121.57, lat: 25.04, countries: ["Taiwan"] },
  { id: "tel-aviv", name: "Tel Aviv", lon: 34.78, lat: 32.08, countries: ["Israel"], radius: 200 },
  { id: "tripolis", name: "Tripolis", lon: 13.19, lat: 32.89, countries: ["Libya"] },
  { id: "tunis", name: "Tunis", lon: 10.18, lat: 36.81, countries: ["Tunisia"] },
  { id: "vancouver", name: "Vancouver", lon: -123.12, lat: 49.28, countries: ["Canada", "United States"] },
  { id: "warschau", name: "Warschau", lon: 21.01, lat: 52.23, countries: ["Poland", "Germany", "Lithuania"], radius: 500 },
  { id: "wien", name: "Wien", lon: 16.37, lat: 48.21, countries: ["Italy", "Croatia", "Germany"], radius: 500 },
  { id: "wladiwostok", name: "Wladiwostok", lon: 131.89, lat: 43.12, countries: ["Russia"] },
  { id: "yangon", name: "Yangon", lon: 96.2, lat: 16.87, countries: ["Myanmar"] },
];

window.LAND_DEFAULTS = { k: 40, radius: 300, hubKm: 60 };

// Handgesetzte Landverbindungen zwischen Städten (vereinfacht, Luftlinie). Sie ergänzen das
// automatisch erzeugte Landnetz (data/landlinks.js, tools/land-links.js) dort, wo die grobe
// Küste der Ländergrenzen eine echte Landstrecke nicht erkennt oder die Strecke zu lang ist.
window.CITY_LINKS = [
  ["new-york", "los-angeles"],      // quer durch die USA
  ["new-york", "halifax"],          // Neuengland / Maritimes
  ["new-york", "miami"],            // US-Ostküste
  ["mexiko-stadt", "los-angeles"],
  ["mexiko-stadt", "panama-stadt"], // Mittelamerika
  ["fortaleza", "rio-de-janeiro"],  // Brasiliens Küste
  ["algier", "tunis"],
  ["algier", "casablanca"],
  ["tripolis", "tunis"],
  ["helsinki", "sankt-petersburg"],
  ["sankt-petersburg", "warschau"],
  ["perth", "melbourne"],           // Nullarbor
  ["johannesburg", "luanda"],       // Namibia / Angola
  ["kairo", "tel-aviv"],            // Sinai
  ["bangkok", "yangon"],
  ["hong-kong", "hanoi"],
];
