import axios from "axios";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY;

const mapping = JSON.parse(fs.readFileSync("weather_health_mapping.json", "utf-8"));
const preventionMapping = JSON.parse(fs.readFileSync("prevention.json", "utf-8"));

function generateHealthAlerts(weather) {
  const alerts = [];

  // Temperature
  if (weather.temperature >= mapping.temperature.very_high.threshold) {
    alerts.push(...mapping.temperature.very_high.alerts);
  } else if (weather.temperature >= mapping.temperature.high.threshold) {
    alerts.push(...mapping.temperature.high.alerts);
  } else if (weather.temperature <= mapping.temperature.very_cold.threshold) {
    alerts.push(...mapping.temperature.very_cold.alerts);
  } else if (weather.temperature <= mapping.temperature.moderate_cold.threshold) {
    alerts.push(...mapping.temperature.moderate_cold.alerts);
  }

  // Humidity
  if (weather.humidity >= mapping.humidity.very_high.threshold) {
    alerts.push(...mapping.humidity.very_high.alerts);
  } else if (weather.humidity >= mapping.humidity.high.threshold) {
    alerts.push(...mapping.humidity.high.alerts);
  } else if (weather.humidity <= mapping.humidity.low.threshold) {
    alerts.push(...mapping.humidity.low.alerts);
  }

  // Wind
  if (weather.wind_speed >= mapping.wind.very_high.threshold) {
    alerts.push(...mapping.wind.very_high.alerts);
  } else if (weather.wind_speed >= mapping.wind.high.threshold) {
    alerts.push(...mapping.wind.high.alerts);
  }

  // UV
  if (weather.uv && weather.uv >= mapping.uv_index.very_high.threshold) {
    alerts.push(...mapping.uv_index.very_high.alerts);
  } else if (weather.uv && weather.uv >= mapping.uv_index.high.threshold) {
    alerts.push(...mapping.uv_index.high.alerts);
  }

  // AQI mapping using us-epa-index (1–6)
  if (weather.aqi >= 5) {
    alerts.push(...mapping.air_quality.very_poor.alerts);
  } else if (weather.aqi >= 3) {
    alerts.push(...mapping.air_quality.poor.alerts);
  }

  // Conditions
  const condition = (weather.description || "").toLowerCase();
  for (let key in mapping.conditions) {
    if (condition.includes(key.toLowerCase())) {
      alerts.push(...mapping.conditions[key]);
    }
  }

  return alerts;
}

function capitalizeFirstLetter(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const weatherController = async (req, res) => {
  try {
    let { city, country } = req.body;
    if (!city) city = "Chennai";

    const placeName = country ? `${city},${country}` : city;

    const url = "http://api.weatherapi.com/v1/current.json";
    const params = {
      key: WEATHERAPI_KEY,
      q: placeName,
      aqi: "yes",
    };

    const response = await axios.get(url, { params });

    const loc = response.data.location;
    const cur = response.data.current;

    // Format datetime
    const dateObj = new Date(loc.localtime);
    const weekday = dateObj.toLocaleDateString("en-GB", { weekday: "long" });
    const formattedDate = dateObj
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(",", "");

    // Keep numeric values for processing
    const formatted = {
      temperature: cur.temp_c,
      humidity: cur.humidity,
      wind_speed: cur.wind_kph,
      uv: cur.uv,
      aqi: cur.air_quality?.["us-epa-index"] || null, // 1–6 scale
      description: cur.condition?.text || "",
      datetime: formattedDate,
      city: capitalizeFirstLetter(loc.name),
      country: loc.country,
      day: weekday,
    };

    // Generate alerts
    const healthOutput = generateHealthAlerts(formatted);

    // Prepare final response
    let result;
    if (healthOutput.length > 0) {
      const preventionOutput = [];
      for (let key in preventionMapping) {
        if (healthOutput.includes(key)) {
          preventionOutput.push(...preventionMapping[key]);
        }
      }
      result = {
        message: "success",
        data: {
          ...formatted,
          humidity: formatted.humidity + "%", // format for output
          wind_speed: formatted.wind_speed + " km/h",
          possible_health_issues: healthOutput,
          preventions: preventionOutput,
        },
      };
    } else {
      result = {
        message: "unavailable",
        data: {
          ...formatted,
          humidity: formatted.humidity + "%",
          wind_speed: formatted.wind_speed + " km/h",
        },
      };
    }

    res.json(result);
  } catch (error) {
    console.error("WeatherAPI error:", error.response?.data || error.message);
    res.status(500).json({
      message: "failed",
      error: error.response?.data || error.message,
    });
  }
};

export default { weatherController };
