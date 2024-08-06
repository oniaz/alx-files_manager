const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    if (await dbClient.emailExists(email)) {
      return res.status(400).json({ error: 'Already exist' });
    }
    const id = await dbClient.createUser(email, password);
    return res.status(201).json({ id, email });
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const id = await redisClient.get(`auth_${token}`);
    if (!id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.findUserById(id);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json({ id, email: user.email });
  }
}

module.exports = UsersController;
