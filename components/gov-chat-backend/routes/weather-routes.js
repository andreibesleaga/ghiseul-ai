const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth-middleware');
const { logger } = require('../shared-lib');

module.exports = (weatherService) => {
  // Apply authentication middleware
  router.use(authMiddleware.authenticate);

  /**
   * @swagger
   * /weather:
   *   post:
   *     summary: Get weather data for a location
   *     description: Fetches current weather and forecast for the specified location. Defaults to server location if no coordinates provided.
   *     tags: [Weather]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               latitude:
   *                 type: number
   *                 description: Latitude of the location
   *               longitude:
   *                 type: number
   *                 description: Longitude of the location
   *               userId:
   *                 type: string
   *                 description: ID of the user requesting weather
   *           example:
   *             latitude: -6.2088
   *             longitude: 106.8456
   *             userId: "2133"
   *     responses:
   *       200:
   *         description: Weather data retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 location:
   *                   type: string
   *                 current:
   *                   type: object
   *                   properties:
   *                     temperature:
   *                       type: integer
   *                     condition:
   *                       type: string
   *                     humidity:
   *                       type: integer
   *                     windSpeed:
   *                       type: integer
   *                 forecast:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       date:
   *                         type: string
   *                         format: date-time
   *                       condition:
   *                         type: string
   *                       highTemp:
   *                         type: integer
   *                       lowTemp:
   *                         type: integer
   *       400:
   *         description: Invalid location data
   *       401:
   *         description: Unauthorized - Invalid or missing authentication token
   *       500:
   *         description: Server error
   */
  router.post('/', async (req, res) => {
    try {
      const { latitude, longitude, userId } = req.body;

      // Validate coordinates if provided
      if ((latitude && !longitude) || (!latitude && longitude)) {
        return res.status(400).json({ message: 'Both latitude and longitude must be provided' });
      }
      if (latitude && (latitude < -90 || latitude > 90)) {
        return res.status(400).json({ message: 'Invalid latitude' });
      }
      if (longitude && (longitude < -180 || longitude > 180)) {
        return res.status(400).json({ message: 'Invalid longitude' });
      }

      logger.info(`Fetching weather for user ${userId || 'anonymous'} at lat:${latitude}, lon:${longitude}`);

      const weatherData = await weatherService.getWeather({ latitude, longitude, userId });
      res.json(weatherData);
    } catch (error) {
      logger.error(`Error fetching weather: ${error.message}`, { stack: error.stack });
      res.status(500).json({ message: error.message });
    }
  });

  return router;
};