import city from "../../config/city.json";

const WEATHER_CODE_MAP = {
  0: { description: "clear sky", icon: "01d" },
  1: { description: "mainly clear", icon: "02d" },
  2: { description: "partly cloudy", icon: "03d" },
  3: { description: "overcast", icon: "04d" },
  45: { description: "fog", icon: "50d" },
  48: { description: "depositing rime fog", icon: "50d" },
  51: { description: "light drizzle", icon: "09d" },
  53: { description: "moderate drizzle", icon: "09d" },
  55: { description: "dense drizzle", icon: "09d" },
  61: { description: "slight rain", icon: "10d" },
  63: { description: "moderate rain", icon: "10d" },
  65: { description: "heavy rain", icon: "10d" },
  71: { description: "slight snow fall", icon: "13d" },
  73: { description: "moderate snow fall", icon: "13d" },
  75: { description: "heavy snow fall", icon: "13d" },
  95: { description: "thunderstorm", icon: "11d" },
};

function findCurrentIndex(currentTime, hourlyTimes) {
  if (!currentTime || !hourlyTimes || hourlyTimes.length === 0) return 0;

  let idx = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < hourlyTimes.length; i++) {
    const t = hourlyTimes[i];
    const diff = Math.abs(t - currentTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      idx = i;
    }
  }

  return idx;
}

export default async function handler(req, res) {
  try {
    const { latitude, longitude, name, country, timezone } = city;
    const params = new URLSearchParams({
      latitude: latitude,
      longitude: longitude,
      daily: "sunrise,sunset",
      hourly: "visibility",
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m",
      timezone: timezone,
      timeformat: "unixtime",
    });
    const url = `https://api.open-meteo.com/v1/forecast?${params}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.current || !data.daily) {
      return res
        .status(500)
        .json({ message: "Weather data not available from Open-Meteo" });
    }

    const { hourly, daily, current, utc_offset_seconds } = data;
    const idx = findCurrentIndex(current.time, hourly.time);

    const visibility =
      hourly.visibility && hourly.visibility[idx] != null
        ? hourly.visibility[idx]
        : 10000;

    const weatherCode = current?.weather_code ?? 0;

    const codeInfo = WEATHER_CODE_MAP[weatherCode] || {
      description: "unknown",
      icon: "01d",
    };

    const mapped = {
      name,
      sys: {
        country,
        sunrise: daily.sunrise ? daily.sunrise[0] : 0,
        sunset: daily.sunset ? daily.sunset[0] : 0,
      },
      timezone: utc_offset_seconds || 0,
      dt: current.time,
      main: {
        temp: current.temperature_2m,
        feels_like: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
      },
      weather: [
        {
          description: codeInfo.description,
          icon: codeInfo.icon,
        },
      ],
      wind: {
        speed: current.wind_speed_10m,
        deg: current.wind_direction_10m,
      },
      visibility,
    };

    res.status(200).json(mapped);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error fetching weather data from Open-Meteo" });
  }
}
