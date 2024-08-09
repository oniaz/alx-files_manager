const Bull = require('bull');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs');
const dbClient = require('./utils/db');

const fsPromises = fs.promises;
const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job, done) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    return done(new Error('Missing fileId'));
  }

  if (!userId) {
    return done(new Error('Missing userId'));
  }

  const file = await dbClient.findFileByIdAndUserId(fileId, userId);
  if (!file) {
    return done(new Error('File not found'));
  }

  try {
    const sizes = [500, 250, 100];
    const promises = sizes.map(async (width) => {
      const thumbnail = await imageThumbnail(file.localPath, { width });
      const thumbnailPath = `${file.localPath}_${width}`;
      await fsPromises.writeFile(thumbnailPath, thumbnail);
      return null;
    });

    await Promise.all(promises);
    done();
    return null;
  } catch (error) {
    done(error);
    return null;
  }
});
