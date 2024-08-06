const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class AppController {
  static getStatus(req, res) {
    console.log(dbClient.isAlive());
    res.status(200).json({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
  }

  static getOoga(req, res) {
    res.status(200).json({ oog: 13 });
  }

  static async getStats(req, res) {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();
    res.status(200).json({ users, files });
  }
}

module.exports = AppController;
