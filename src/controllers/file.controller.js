const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FileModel = require("../models/file.model");
const { fileParserService } = require("../service/fileParser.service");
const { updateProgress, VALID_STATUSES } = require("../utils/progressStore");

const IndexFileController = async (req, res) => {
    let fileId = null;
    let filePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        fileId = uuidv4();
        filePath = req.file.path;
        const filename = req.file.originalname;
        const fileSize = req.file.size;

        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const fileExtension = path.extname(filename).toLowerCase();
        
        if (!allowedExtensions.includes(fileExtension)) {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return res.status(400).json({
                success: false,
                message: "Unsupported file type. Only CSV and Excel files are allowed."
            });
        }

        updateProgress(fileId, VALID_STATUSES.UPLOADING, 10, {
            filename: filename,
            fileSize: fileSize,
            fileExtension: fileExtension,
            uploadStarted: new Date().toISOString()
        });

        const fileRecord = new FileModel({
            file_id: fileId,
            filename: filename,
            status: VALID_STATUSES.UPLOADING,
            parsedContent: []
        });

        await fileRecord.save();

        updateProgress(fileId, VALID_STATUSES.UPLOADING, 25, {
            dbRecordCreated: true
        });

        res.status(200).json({
            success: true,
            file_id: fileId,
            filename: filename,
            check_status: `http://localhost:4040/api/v1/files/${fileId}/progress`
        });

        processFileAsync(fileId, filePath, filename, fileSize);

    } catch (error) {
        if (fileId) {
            updateProgress(fileId, VALID_STATUSES.FAILED, 0, {
                error: error.message,
                failedAt: new Date().toISOString()
            });
            
            try {
                await FileModel.findOneAndUpdate(
                    { file_id: fileId },
                    { status: VALID_STATUSES.FAILED }
                );
            } catch {}
        }

        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "Error while indexing file",
                error: error.message
            });
        }
    }
};

const processFileAsync = async (fileId, filePath, filename, fileSize) => {
    try {
        updateProgress(fileId, VALID_STATUSES.PROCESSING, 40, {
            processingStarted: new Date().toISOString()
        });

        await FileModel.findOneAndUpdate(
            { file_id: fileId },
            { status: VALID_STATUSES.PROCESSING }
        );

        const processingDelay = Math.min(2000, Math.max(500, fileSize / 1000));
        await new Promise(resolve => setTimeout(resolve, processingDelay));
        
        updateProgress(fileId, VALID_STATUSES.PROCESSING, 60, {
            parsingInitialized: true
        });

        const parseStartTime = Date.now();
        const parsedContent = await fileParserService(filePath, filename);
        const parseEndTime = Date.now();
        const parseTime = parseEndTime - parseStartTime;
        
        updateProgress(fileId, VALID_STATUSES.PROCESSING, 85, {
            parsingCompleted: true,
            parseTime: parseTime,
            recordCount: parsedContent.length
        });

        await FileModel.findOneAndUpdate(
            { file_id: fileId },
            { 
                status: VALID_STATUSES.READY,
                parsedContent: parsedContent
            }
        );

        updateProgress(fileId, VALID_STATUSES.READY, 100, {
            processingCompleted: new Date().toISOString(),
            totalProcessingTime: Date.now() - parseStartTime,
            finalRecordCount: parsedContent.length,
            dbSaved: true
        });

    } catch (error) {
        updateProgress(fileId, VALID_STATUSES.FAILED, 0, {
            error: error.message,
            errorStack: error.stack,
            failedAt: new Date().toISOString(),
            processingStage: 'file_parsing'
        });

        await FileModel.findOneAndUpdate(
            { file_id: fileId },
            { status: VALID_STATUSES.FAILED }
        );
    } finally {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
};

module.exports = {
    IndexFileController
};
