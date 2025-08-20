const fs = require('fs');
const path = require('path');
const FileModel = require("../models/file.model");
const { deleteProgress, getProgress } = require("../utils/progressStore");

const deleteFileController = async (req, res) => {
    try {
        const { file_id } = req.params;
        if (!file_id) {
            return res.status(400).json({
                success: false,
                message: "File ID is required"
            });
        }

        const fileRecord = await FileModel.findOne({ file_id });
        if (!fileRecord) {
            return res.status(404).json({
                success: false,
                message: "File not found"
            });
        }

        const fileInfo = {
            file_id: fileRecord.file_id,
            filename: fileRecord.filename,
            status: fileRecord.status,
            created_at: fileRecord.created_at,
            record_count: fileRecord.parsedContent ? fileRecord.parsedContent.length : 0
        };

        const progressData = getProgress(file_id);
        if (progressData) {
            fileInfo.file_size = progressData.fileSize;
            fileInfo.processing_time_ms = progressData.totalProcessingTime;
        }

        const deleteResult = await FileModel.findOneAndDelete({ file_id });
        if (!deleteResult) {
            return res.status(404).json({
                success: false,
                message: "File not found or already deleted"
            });
        }

        const progressDeleted = deleteProgress(file_id);

        const possibleTempPaths = [
            path.join('uploads', 'files', fileRecord.filename),
            path.join('uploads', 'files', `${fileRecord.filename}-*`),
            path.join('temp', fileRecord.filename),
            path.join('tmp', fileRecord.filename)
        ];

        let tempFilesDeleted = 0;
        for (const tempPath of possibleTempPaths) {
            try {
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                    tempFilesDeleted++;
                }
            } catch {}
        }

        try {
            const uploadsDir = path.join('uploads', 'files');
            if (fs.existsSync(uploadsDir)) {
                const files = fs.readdirSync(uploadsDir);
                const baseFileName = path.parse(fileRecord.filename).name;
                const fileExtension = path.extname(fileRecord.filename);
                
                const relatedFiles = files.filter(file => {
                    return file.startsWith(baseFileName) && file.endsWith(fileExtension);
                });

                for (const relatedFile of relatedFiles) {
                    const fullPath = path.join(uploadsDir, relatedFile);
                    try {
                        fs.unlinkSync(fullPath);
                        tempFilesDeleted++;
                    } catch {}
                }
            }
        } catch {}

        const response = {
            success: true,
            message: "File deleted successfully",
            deleted_file: {
                file_id: fileInfo.file_id,
                filename: fileInfo.filename,
                status: fileInfo.status,
                created_at: fileInfo.created_at
            },
            cleanup_summary: {
                database_record_deleted: true,
                progress_data_deleted: progressDeleted,
                temporary_files_deleted: tempFilesDeleted
            }
        };

        if (fileInfo.record_count > 0) {
            response.deleted_file.records_deleted = fileInfo.record_count;
        }

        if (fileInfo.file_size) {
            response.deleted_file.file_size = fileInfo.file_size;
            response.deleted_file.file_size_formatted = formatFileSize(fileInfo.file_size);
        }

        if (fileInfo.processing_time_ms) {
            response.deleted_file.processing_time_ms = fileInfo.processing_time_ms;
        }

        if (fileRecord.status === 'processing') {
            response.warning = "File was being processed when deleted. Processing has been terminated.";
        }

        res.status(200).json(response);

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error deleting file",
            error: error.message
        });
    }
};

const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

module.exports = {
    deleteFileController
};
