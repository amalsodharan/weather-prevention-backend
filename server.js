import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

import weatherController from './controller/weatherController.js';

const app = express();

app.use(express.json());
const PORT = process.env.PORT;


app.get('/api', (req, res) => {
    res.json({message: `This is a sample api`})
});

app.post('/api/weather', weatherController.weatherController);

app.listen(PORT, (req, res) => {
    console.log(`App is running on ${PORT}.....`);
});