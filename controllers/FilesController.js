const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

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

    const parentId = req.body.parentId || 0;
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

    if (parentId) {
      const parentFile = await dbClient.findFileById(parentId);
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileData = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };

    if (type !== 'folder') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const fileUUID = uuidv4();
      const localPath = path.join(folderPath, fileUUID);
      fileData.localPath = localPath;
      // fileData.isPublic = isPublic;

      if (!fs.existsSync(folderPath)) {
        await fsPromises.mkdir(folderPath, { recursive: true });
      }
      const buffer = Buffer.from(data, 'base64');
      await fsPromises.writeFile(localPath, buffer);
    }

    const savedFile = await dbClient.createFile(fileData);
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
    if (!fileId) {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.findFileByIdAndUserId(fileId, userId);
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json(file);
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

    const parentId = parseInt(req.query.parentId, 10) || 0;
    const page = parseInt(req.query.page, 10) || 0;
    const skip = page * 20;

    const results = await dbClient.findFilesByParentId(parentId, skip);

    return res.json(results);
  }
}

module.exports = FilesController;
