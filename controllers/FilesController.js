const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { ObjectId } = require('mongodb');
const mime = require('mime-types');
const Bull = require('bull');

const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const fileQueue = new Bull('fileQueue');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      type,
      data,
    } = req.body;

    const parentId = req.body.parentId || '0';
    const isPublic = req.body.isPublic || false;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== '0') {
      const parentFile = await dbClient.findFileById(parentId);
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileData = {
      userId: new ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === '0' ? '0' : new ObjectId(parentId),
    };

    if (type !== 'folder') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const fileUUID = uuidv4();
      const localPath = path.join(folderPath, fileUUID);
      fileData.localPath = localPath;

      // create file locally
      if (!fs.existsSync(folderPath)) {
        await fsPromises.mkdir(folderPath, { recursive: true });
      }
      const buffer = Buffer.from(data, 'base64');
      await fsPromises.writeFile(localPath, buffer);
    }

    const savedFile = await dbClient.createFile(fileData);

    if (type === 'image') {
      fileQueue.add({ userId, fileId: savedFile.insertedId.toString() });
    }

    return res.status(201).json(savedFile);
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    if (!fileId || fileId === '0') {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.findFileByIdAndUserId(fileId, userId);
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;
    const skip = (page) * 20;

    const results = await dbClient.findFilesByParentId(parentId, skip);

    return res.status(200).json(results);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    if (!fileId || fileId === '0') {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.findFileByIdAndUserId(fileId, userId);
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    const updatedFile = await dbClient.setToPublic(fileId);

    return res.status(200).json(updatedFile);
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    if (!fileId || fileId === '0') {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.findFileByIdAndUserId(fileId, userId);
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    const updatedFile = await dbClient.setToPrivate(fileId);

    return res.status(200).json(updatedFile);
  }

  static async getFile(req, res) {
    const fileId = req.params.id;
    if (!fileId || fileId === '0') {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.findFileById(fileId);
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file.isPublic) {
      const token = req.headers['x-token'];
      if (!token) {
        return res.status(404).json({ error: 'Not found' });
      }

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (file.userId.toHexString() !== userId) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    try {
      await fsPromises.access(file.localPath);
      const { size } = req.query;
      let absPath = file.localPath;
      if (size) {
        absPath = `${file.localPath}_${size}`;
      }
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      return res.status(200).sendFile(absPath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'Not found' });
      }
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

module.exports = FilesController;
