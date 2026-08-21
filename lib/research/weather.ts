// Open-Meteo: completely free, no API key needed.
// Geocoding: also Open-Meteo (free).

const cache = new Map<string, { data: string; ts: number }>();
const TTL = 60 * 60 * 1000; // 1 hour

interface GeoResult {
  results?: Array<{ name: string; latitude: number; longitude: number; country_code: string; admin1?: string }>;
}

interface Forecast {
  daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max?: number[] };
  hourly?: { time: string[]; temperature_2m: number[] };
}

async function geocode(city: string): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`);
    if (!res.ok) return null;
    const data: GeoResult = await res.json();
    const hit = data.results?.find((r) => r.country_code === "US") ?? data.results?.[0];
    if (!hit) return null;
    return { lat: hit.latitude, lon: hit.longitude, label: [hit.name, hit.admin1].filter(Boolean).join(", ") };
  } catch { return null; }
}

function extractCity(question: string): string | null {
  const m =
    question.match(/\bin\s+([A-Z][a-zA-Z ]{2,30})(?:\s+on\s|\s+during\s|\s+this\s|\?|,|$)/)?.[1]?.trim() ??
    question.match(/([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:temperature|weather|rainfall|rain|snow|wind)/i)?.[1]?.trim();
  return m ?? null;
}

function extractDate(question: string): string | null {
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
    jan: "01", feb: "02", mar: "03", apr: "04", jun: "06", jul: "07", aug: "08",
    sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const md = question.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})\b/i);
  if (md) {
    const month = months[md[1].toLowerCase()];
    const day = md[2].padStart(2, "0");
    const now = new Date();
    // If the resulting date is in the past, assume next year
    const year = now.getFullYear();
    const candidate = `${year}-${month}-${day}`;
    const candidateDate = new Date(candidate);
    return candidateDate < now ? `${year + 1}-${month}-${day}` : candidate;
  }
  return question.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

export async function getWeatherContext(question: string): Promise<string> {
  const city = extractCity(question);
  if (!city) return "";

  const targetDate = extractDate(question);
  // Include target date in cache key — same city queried for different dates must not collide
  const ckey = `${city.toLowerCase()}::${targetDate ?? "general"}`;
  const hit = cache.get(ckey);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;

  const geo = await geocode(city);
  if (!geo) return "";

  try {
    const params = new URLSearchParams({
      latitude: String(geo.lat),
      longitude: String(geo.lon),
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      hourly: "temperature_2m",
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: "auto",
      forecast_days: "7",
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) return "";
    const data: Forecast = await res.json();
    if (!data.daily) return "";

    const { time, temperature_2m_max, temperature_2m_min, precipitation_probability_max } = data.daily;
    const days = time.map((date, i) => ({
      date,
      max: Math.round(temperature_2m_max[i]),
      min: Math.round(temperature_2m_min[i]),
      precip: precipitation_probability_max?.[i] ?? 0,
    }));

    const relevant = targetDate ? days.filter((d) => d.date >= targetDate).slice(0, 3) : days.slice(0, 5);
    const dailyLines = relevant.map((d) => `  ${d.date}: High ${d.max}°F / Low ${d.min}°F | ${d.precip}% precip chance`);

    let hourlyBlock = "";
    if (targetDate && data.hourly) {
      const forDate = data.hourly.time
        .map((t, i) => ({ t, temp: Math.round(data.hourly!.temperature_2m[i]) }))
        .filter((h) => h.t.startsWith(targetDate));
      if (forDate.length) {
        const peak = Math.max(...forDate.map((h) => h.temp));
        const peakTime = forDate.find((h) => h.temp === peak)?.t.slice(11, 16) ?? "?";
        const sampled = forDate.filter((_, i) => i % 3 === 0).map((h) => `${h.t.slice(11, 16)}: ${h.temp}°F`);
        hourlyBlock = `  Hourly forecast for ${targetDate}: ${sampled.join(", ")}\n  Forecast peak: ${peak}°F around ${peakTime}`;
      }
    }

    const result = [`=== LIVE WEATHER FORECAST — ${geo.label.toUpperCase()} (Open-Meteo) ===`, ...dailyLines, hourlyBlock]
      .filter(Boolean)
      .join("\n");

    cache.set(ckey, { data: result, ts: Date.now() });
    return result;
  } catch { return ""; }
}
