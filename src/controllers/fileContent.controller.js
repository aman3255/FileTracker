const FileModel = require("../models/file.model");
const { getProgress, VALID_STATUSES } = require("../utils/progressStore");

const fileContentController = async (req, res) => {
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

        if (fileRecord.status === VALID_STATUSES.READY) {
            const progressData = getProgress(file_id);
            
            const response = {
                success: true,
                file_id: file_id,
                filename: fileRecord.filename,
                status: fileRecord.status,
                created_at: fileRecord.created_at,
                content: fileRecord.parsedContent,
                total_records: fileRecord.parsedContent ? fileRecord.parsedContent.length : 0
            };

            if (progressData) {
                if (progressData.processingCompleted) {
                    response.processing_completed = progressData.processingCompleted;
                }
                if (progressData.totalProcessingTime) {
                    response.processing_time_ms = progressData.totalProcessingTime;
                }
                if (progressData.fileSize) {
                    response.file_size = progressData.fileSize;
                }
            }
            
            return res.status(200).json(response);
            
        } else if (fileRecord.status === VALID_STATUSES.FAILED) {
            const progressData = getProgress(file_id);
            
            const response = {
                success: false,
                message: "File processing failed",
                file_id: file_id,
                filename: fileRecord.filename,
                status: fileRecord.status,
                created_at: fileRecord.created_at
            };

            if (progressData && progressData.error) {
                response.error = progressData.error;
                response.failed_at = progressData.failedAt;
            }
            
            return res.status(422).json(response);
            
        } else {
            const progressData = getProgress(file_id);
            
            const response = {
                success: false,
                message: "File upload or processing in progress. Please try again later.",
                file_id: file_id,
                filename: fileRecord.filename,
                status: fileRecord.status,
                created_at: fileRecord.created_at
            };

            if (progressData) {
                response.progress = progressData.progress;
                response.check_status = `http://localhost:4040/api/v1/files/${file_id}/progress`;
                
                if (fileRecord.status === VALID_STATUSES.PROCESSING && progressData.processingStarted) {
                    const processingStartTime = new Date(progressData.processingStarted).getTime();
                    const currentTime = Date.now();
                    const elapsedTime = currentTime - processingStartTime;
                    const estimatedTotalTime = 5000;
                    const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);
                    response.estimated_completion_seconds = Math.ceil(remainingTime / 1000);
                }
            } else {
                response.check_status = `http://localhost:4040/api/v1/files/${file_id}/progress`;
                response.note = "Use the check_status URL to monitor progress";
            }
            
            return res.status(202).json(response);
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving file content",
            error: error.message
        });
    }
};

module.exports = {
    fileContentController
};
