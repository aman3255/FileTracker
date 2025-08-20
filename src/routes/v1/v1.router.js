const express = require('express');
const { IndexFileController } = require('../../controllers/file.controller');
const { multerMiddleware } = require('../../middlewares/multer.middleware');
const { statusController } = require('../../controllers/status.controller');
const { listFileController } = require('../../controllers/listFile.controller');
const { deleteFileController } = require('../../controllers/deleteFile.controller');
const { fileContentController } = require('../../controllers/fileContent.controller');

const v1Router = express.Router();

// upload files route 
v1Router.post('/files', multerMiddleware, IndexFileController);
v1Router.get('/files/:file_id/', fileContentController);
v1Router.get('/files/:file_id/progress', statusController);
v1Router.delete('/files/:file_id', deleteFileController);
v1Router.get('/files', listFileController);

module.exports = v1Router;