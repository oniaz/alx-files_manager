const { Buffer } = require('buffer');
const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const base64Credentials = authHeader.replace('Basic ', '');
    const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const credentials = decodedCredentials.split(':');
    const email = credentials[0];
    const password = credentials[1];

    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.findUserByEmailAndPassword(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const redisKey = `auth_${token}`;

    await redisClient.set(redisKey, user._id.toString(), (24 * 60 * 60));

    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = await redisClient.get(`auth_${token}`);
    if (!id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(`auth_${token}`);

    return res.status(204).end();
  }
}

module.exports = AuthController;
