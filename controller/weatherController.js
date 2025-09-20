import axios from 'axios';
import fs from 'fs';

const mapping = JSON.parse(fs.readFileSync('weather_health_mapping.json', 'utf-8'));
const preventionMapping = JSON.parse(fs.readFileSync('prevention.json', 'utf-8'));

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

    // UV index
    if (weather.uv && weather.uv >= mapping.uv_index.very_high.threshold) {
        alerts.push(...mapping.uv_index.very_high.alerts);
    } else if (weather.uv && weather.uv >= mapping.uv_index.high.threshold) {
        alerts.push(...mapping.uv_index.high.alerts);
    }

    // AQI
    if (weather.aqi && weather.aqi >= mapping.air_quality.very_poor.aqi) {
        alerts.push(...mapping.air_quality.very_poor.alerts);
    } else if (weather.aqi && weather.aqi >= mapping.air_quality.poor.aqi) {
        alerts.push(...mapping.air_quality.poor.alerts);
    }

    return alerts;
}

function capitalizeFirstLetter(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function getCoordinates(place) {
    const url = 'https://geocoding-api.open-meteo.com/v1/search';
    var status = '';
    const response = await axios.get(url, { params: { name: place, count: 1 } });
    if (response.data.results && response.data.results.length > 0) {
        const { latitude, longitude, name, country } = response.data.results[0];
        status = 'success';
        return { status, latitude, longitude, name, country };
    }
    status = 'failed';
    return { status };
}

const weatherController = async (req, res) => {
    let { city, country } = req.body;

    if (!city) {
        city = 'Chennai';
    }

    // Get coordinates
    const placeName = country ? `${city}, ${country}` : city;
    const geo = await getCoordinates(placeName);
    if(geo.status == 'failed'){
        return res.status(400).json({ message: "Unable to fetch data place deatils" });
    }

    const latitude = geo.latitude;
    const longitude = geo.longitude;

    if (!latitude || !longitude) {
        return res.status(400).json({ message: 'Latitude and longitude required' });
    }

    const url = 'https://api.open-meteo.com/v1/forecast';
    const params = {
        latitude,
        longitude,
        current: [
            'temperature_2m',
            'relative_humidity_2m',
            'wind_speed_10m',
            'uv_index',
            'apparent_temperature'
        ].join(','),
        air_quality: true
    };

    try {
        const response = await axios.get(url, { params });
        const data = response.data.current;
        const dataUnit = response.data.current_units;
        const air = response.data.current.air_quality || {};

        const dateObj = new Date();

        const weekday = dateObj.toLocaleDateString("en-GB", { weekday: "long" });
        const dataformatted = dateObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
        }).replace(",", ""); 

        const formatted = {
            temperature: data.temperature_2m,
            humidity: data.relative_humidity_2m + dataUnit.relative_humidity_2m,
            wind_speed: data.wind_speed_10m + dataUnit.wind_speed_10m,
            uv: data.uv_index,
            aqi: air.us_aqi || null,
            datetime: dataformatted,
            city: capitalizeFirstLetter(placeName),
            day: weekday
        };

        const healthOutput = generateHealthAlerts(formatted);

        let result;
        if (healthOutput.length > 0) {
            const preventionOutput = [];
            for (let key in preventionMapping) {
                if (healthOutput.includes(key)) {
                    preventionOutput.push(...preventionMapping[key]);
                }
            }       
            result = {
                message: 'success',
                data: {
                    ...formatted,
                    possible_health_issues: healthOutput,
                    preventions: preventionOutput
                }
            };
        } else {
            result = { message: 'unavailable', data: formatted };
        }

        res.json(result);
    } catch (error) {
        console.error('Open-Meteo API error:', error.response?.data || error.message);
        res.status(500).json({ message: 'failed', error: error.response?.data || error.message });
    }
};

export default { weatherController };
            