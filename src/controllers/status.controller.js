const FileModel = require("../models/file.model");
const { getProgress, VALID_STATUSES, PROGRESS_RANGES } = require("../utils/progressStore");

const statusController = async (req, res) => {
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

        const progressData = getProgress(file_id);
        
        if (progressData) {
            const response = {
                file_id: file_id,
                status: progressData.status,
                progress: progressData.progress
            };

            if (progressData.filename) response.filename = progressData.filename;
            if (progressData.fileSize) response.file_size = progressData.fileSize;
            if (progressData.recordCount) response.record_count = progressData.recordCount;
            if (progressData.processingStarted) response.processing_started = progressData.processingStarted;
            if (progressData.processingCompleted) response.processing_completed = progressData.processingCompleted;
            if (progressData.totalProcessingTime) response.processing_time_ms = progressData.totalProcessingTime;

            if (progressData.status === VALID_STATUSES.FAILED && progressData.error) {
                response.error = progressData.error;
                response.failed_at = progressData.failedAt;
            }

            res.status(200).json(response);

        } else {
            let progress = 0;
            let estimatedProgress = false;

            switch (fileRecord.status) {
                case VALID_STATUSES.UPLOADING:
                    progress = PROGRESS_RANGES[VALID_STATUSES.UPLOADING].min;
                    estimatedProgress = true;
                    break;
                case VALID_STATUSES.PROCESSING:
                    progress = Math.floor((PROGRESS_RANGES[VALID_STATUSES.PROCESSING].min + 
                                         PROGRESS_RANGES[VALID_STATUSES.PROCESSING].max) / 2);
                    estimatedProgress = true;
                    break;
                case VALID_STATUSES.READY:
                    progress = PROGRESS_RANGES[VALID_STATUSES.READY].max;
                    break;
                case VALID_STATUSES.FAILED:
                    progress = PROGRESS_RANGES[VALID_STATUSES.FAILED].max;
                    break;
                default:
                    progress = 0;
                    estimatedProgress = true;
            }

            const response = {
                file_id: file_id,
                status: fileRecord.status,
                progress: progress,
                filename: fileRecord.filename
            };

            if (estimatedProgress) {
                response.note = "Progress estimated from database status";
            }

            if (fileRecord.status === VALID_STATUSES.READY && fileRecord.parsedContent) {
                response.record_count = fileRecord.parsedContent.length;
            }

            res.status(200).json(response);
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving file status",
            error: error.message
        });
    }
};

module.exports = {
    statusController
};
