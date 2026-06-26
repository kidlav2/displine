export interface Country { code: string; dial: string; flag: string; name: string; }

export const COUNTRIES: Country[] = [
  { code: "KZ", dial: "+7",   flag: "🇰🇿", name: "Kazakhstan"    },
  { code: "RU", dial: "+7",   flag: "🇷🇺", name: "Russia"         },
  { code: "UZ", dial: "+998", flag: "🇺🇿", name: "Uzbekistan"     },
  { code: "KG", dial: "+996", flag: "🇰🇬", name: "Kyrgyzstan"     },
  { code: "US", dial: "+1",   flag: "🇺🇸", name: "United States"  },
  { code: "CA", dial: "+1",   flag: "🇨🇦", name: "Canada"         },
  { code: "GB", dial: "+44",  flag: "🇬🇧", name: "United Kingdom" },
  { code: "DE", dial: "+49",  flag: "🇩🇪", name: "Germany"        },
  { code: "TR", dial: "+90",  flag: "🇹🇷", name: "Turkey"         },
  { code: "AE", dial: "+971", flag: "🇦🇪", name: "UAE"            },
];
