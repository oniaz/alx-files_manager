const { MongoClient, ObjectId } = require('mongodb');
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
    const file = await this.db.collection('users').findOne({ email });
    return !!file; // this is smart :3
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

  async findUserByEmailAndPassword(email, password) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
    return this.db.collection('users').findOne({ email, password: hashedPassword });
  }

  async findUserById(id) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    const objectId = new ObjectId(id);
    const user = await this.db.collection('users').findOne({ _id: objectId });
    return user;
  }

  async findFileById(id) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    const objectId = new ObjectId(id);
    const file = await this.db.collection('files').findOne({ _id: objectId });
    return file;
  }

  async findFileByIdAndUserId(id, userId) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    const objectId = new ObjectId(id);
    const file = await this.db.collection('files').findOne({ _id: objectId, userId });
    return file;
  }

  async findFilesByParentId(parentId, skip) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    const results = await this.db.collection('files').aggregate([
      { $match: { parentId } },
      { $skip: skip },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          userId: 1,
          name: 1,
          type: 1,
          isPublic: 1,
          parentId: 1,
        },
      },
    ]).toArray();

    return results;
  }

  async createFile(fileData) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    const result = await this.db.collection('files').insertOne(fileData);

    const savedFile = {
      id: result.insertedId.toHexString(),
      userId: fileData.userId.toHexString(),
      name: fileData.name,
      type: fileData.type,
      isPublic: fileData.isPublic,
      parentId: fileData.parentId,
    };
    return savedFile;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
