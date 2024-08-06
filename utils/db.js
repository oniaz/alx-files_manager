const { MongoClient } = require('mongodb');
const crypto = require('crypto');

class DBClient {
  constructor() {
    this.host = process.env.DB_HOST || 'localhost';
    this.port = process.env.DB_PORT || 27017;
    this.dbName = process.env.DB_DATABASE || 'files_manager';

    this.client = new MongoClient(`mongodb://${this.host}:${this.port}`, { useNewUrlParser: true, useUnifiedTopology: true });
    this.db = null;

    this.client.connect()
      .then(() => {
        this.db = this.client.db(this.dbName);
      });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    return this.db.collection('files').countDocuments();
  }

  async emailExists(email) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    const user = await this.db.collection('users').findOne({ email });
    return !!user; // this is smart :3
  }

  async createUser(email, password) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }

    const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
    const result = await this.db.collection('users').insertOne({ email, password: hashedPassword });

    return result.insertedId;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
