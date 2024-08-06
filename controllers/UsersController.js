const dbClient = require('../utils/db');

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
}

module.exports = UsersController;
