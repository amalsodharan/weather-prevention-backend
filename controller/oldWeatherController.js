import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const WEATHERBITKEY = process.env.WEATHERBIT_API_KEY;

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

    // Conditions
    // const condition = weather.description.toLowerCase();
    const condition = (weather.description || "").toLowerCase();

    for (let key in mapping.conditions) {
        if (condition.includes(key.toLowerCase())) {
            alerts.push(...mapping.conditions[key]);
        }
    }


    // Wind
    if (weather.wind_speed >= mapping.wind.very_high.threshold) {
        alerts.push(...mapping.wind.very_high.alerts);
    } else if (weather.wind_speed >= mapping.wind.high.threshold) {
        alerts.push(...mapping.wind.high.alerts);
    }

    // UV index (if available in Weatherbit response)
    if (weather.uv && weather.uv >= mapping.uv_index.very_high.threshold) {
        alerts.push(...mapping.uv_index.very_high.alerts);
    } else if (weather.uv && weather.uv >= mapping.uv_index.high.threshold) {
        alerts.push(...mapping.uv_index.high.alerts);
    }

    // Air Quality (if available in Weatherbit response)
    if (weather.aqi && weather.aqi >= mapping.air_quality.very_poor.aqi) {
        alerts.push(...mapping.air_quality.very_poor.alerts);
    } else if (weather.aqi && weather.aqi >= mapping.air_quality.poor.aqi) {
        alerts.push(...mapping.air_quality.poor.alerts);
    }

    return alerts;
}

const weatherController = async (req, res) => {
    console.log("runinng", WEATHERBITKEY)
    const input = req.body;

    let city, params;
    if(input && input.city){
        city = input.city;
    }

    const url = 'https://api.weatherbit.io/v2.0/current';

    if(city){
        params = {
            key : WEATHERBITKEY,
            city : city
        }
    }else {
        params = {
            key : WEATHERBITKEY,
            city : 'London'
        }
    }
    console.log("params===>", params)

    try {
        const response = await axios.get(url, { params });
        const results = response.data.data;

        const formatted = results.map((weather, index) => ({
            index: index + 1,
            city: weather.city_name,
            country: weather.country_code,
            temperature: weather.temp,
            description: weather.weather.description,
            wind_speed: weather.wind_spd,
            humidity: weather.rh,
            datetime: weather.ob_time
        }));

        const healthOutput = generateHealthAlerts(formatted[0]);
        let result;
        if(healthOutput != []){
            let preventionOutput = [];
            for(let key in preventionMapping){
                if(healthOutput.includes(key)){
                    preventionOutput.push(...preventionMapping[key]);
                }
            }
            result = {
                message: 'success',
                data:{  
                    city: formatted[0].city,
                    country: formatted[0].country,
                    temperature: formatted[0].temperature,
                    weather_condition: formatted[0].description,
                    possible_health_issues: healthOutput,
                    preventions: preventionOutput,
                    wind_speed: formatted[0].wind_speed,
                    humidity: formatted[0].humidity,
                    datetime: formatted[0].datetime,
                }
            };
        console.log("result1", result)
        }else{
            result = {
                message: 'unavailable',
                data:{
                    city: formatted[0].city,
                    country: formatted[0].country,
                    temperature: formatted[0].temperature,
                    weather_condition: formatted[0].description,
                    wind_speed: formatted[0].wind_speed,
                    humidity: formatted[0].humidity,
                    datetime: formatted[0].datetime,
                }
            }
        }
        console.log("result2", result)
        res.json(result)
    } catch (error) {
        console.error('Weatherbit API error:', error.message);
        res.status(500).json({ message: 'failed', error: 'Failed to fetch weather from Weatherbit' });
    }
}

export default { weatherController };