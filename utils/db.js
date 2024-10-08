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

  // (1) checking if file exists
  async findFileById(id) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    const objectId = new ObjectId(id);
    const file = await this.db.collection('files').findOne({ _id: objectId });
    return file;
  }

  // (1) store a file in db
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
      parentId: (fileData.parentId === '0' || fileData.parentId === 0) ? 0 : fileData.parentId.toHexString(),
    };
    return savedFile;
  }

  // (2) retrieving a specific file for specific user id
  async findFileByIdAndUserId(id, userId) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    const objectId = new ObjectId(id);
    const objectUserId = new ObjectId(userId);

    const result = await this.db.collection('files').findOne({ _id: objectId, userId: objectUserId });
    if (!result) {
      return null;
    }
    const file = {
      id: result._id.toHexString(),
      userId: result.userId.toHexString(),
      name: result.name,
      type: result.type,
      isPublic: result.isPublic,
      parentId: (result.parentId === 0 || result.parentId === '0') ? '0' : result.parentId.toHexString(),
    };
    return file;
  }

  // (3) retrieve a file by parent id
  async findFilesByParentId(parentId, skip) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }

    let query;
    if (parentId === 0 || parentId === '0') {
      query = { parentId: { $in: [0, '0'] } };
    } else {
      query = { parentId: new ObjectId(parentId) };
    }
    // const objectParentId = (parentId === 0 || parentId === '0') ? '0' : new ObjectId(parentId);
    // console.log(objectParentId);
    // console.log(typeof (objectParentId));

    const results = await this.db.collection('files').aggregate([
      { $match: query },
      { $skip: skip },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          userId: { $toString: '$userId' },
          name: 1,
          type: 1,
          isPublic: 1,
          parentId: {
            $cond: {
              if: { $or: [{ $eq: ['$parentId', 0] }, { $eq: ['$parentId', '0'] }] },
              then: '0',
              else: { $toString: '$parentId' },
            },
          },
        },
      },
    ]).toArray();

    return results;
  }

  async setToPublic(id) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    const objectId = new ObjectId(id);

    await this.db.collection('files').updateOne({ _id: objectId }, { $set: { isPublic: true } });
    const updatedFile = await this.db.collection('files').findOne(objectId);

    if (!updatedFile) {
      return null;
    }

    const file = {
      id: updatedFile._id.toHexString(),
      userId: updatedFile.userId.toHexString(),
      name: updatedFile.name,
      type: updatedFile.type,
      isPublic: updatedFile.isPublic,
      parentId: (updatedFile.parentId === 0 || updatedFile.parentId === '0') ? '0' : updatedFile.parentId.toHexString(),
    };
    return file;
  }

  async setToPrivate(id) {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
    const objectId = new ObjectId(id);

    await this.db.collection('files').updateOne({ _id: objectId }, { $set: { isPublic: false } });
    const updatedFile = await this.db.collection('files').findOne(objectId);

    if (!updatedFile) {
      return null;
    }

    const file = {
      id: updatedFile._id.toHexString(),
      userId: updatedFile.userId.toHexString(),
      name: updatedFile.name,
      type: updatedFile.type,
      isPublic: updatedFile.isPublic,
      parentId: (updatedFile.parentId === 0 || updatedFile.parentId === '0') ? '0' : updatedFile.parentId.toHexString(),
    };
    return file;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
