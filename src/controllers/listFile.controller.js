const FileModel = require("../models/file.model");
const { getAllProgress, getProgress, VALID_STATUSES } = require("../utils/progressStore");

const listFileController = async (req, res) => {
    try {
        const {
            status,
            limit = 50,
            page = 1,
            sort = 'created_at',
            order = 'desc'
        } = req.query;

        const filter = {};
        if (status && Object.values(VALID_STATUSES).includes(status)) {
            filter.status = status;
        }

        const skipCount = (parseInt(page) - 1) * parseInt(limit);
        const limitCount = parseInt(limit);

        const sortOrder = order === 'asc' ? 1 : -1;
        const sortObj = { [sort]: sortOrder };

        const totalFiles = await FileModel.countDocuments(filter);

        const files = await FileModel.find(filter, {
            file_id: 1,
            filename: 1,
            status: 1,
            created_at: 1,
            parsedContent: 1,
            _id: 0
        })
        .sort(sortObj)
        .skip(skipCount)
        .limit(limitCount);

        const allProgressData = getAllProgress();
        const progressMap = new Map();
        allProgressData.forEach(progress => {
            progressMap.set(progress.fileId, progress);
        });

        const enrichedFiles = files.map(file => {
            const fileObj = file.toObject();
            const progressData = progressMap.get(file.file_id);

            const enrichedFile = {
                file_id: fileObj.file_id,
                filename: fileObj.filename,
                status: fileObj.status,
                created_at: fileObj.created_at
            };

            if (fileObj.status === VALID_STATUSES.READY && fileObj.parsedContent) {
                enrichedFile.total_records = fileObj.parsedContent.length;
            }

            if (progressData) {
                enrichedFile.progress = progressData.progress;

                if (progressData.fileSize) {
                    enrichedFile.file_size = progressData.fileSize;
                    enrichedFile.file_size_formatted = formatFileSize(progressData.fileSize);
                }

                if (progressData.totalProcessingTime && fileObj.status === VALID_STATUSES.READY) {
                    enrichedFile.processing_time_ms = progressData.totalProcessingTime;
                    enrichedFile.processing_time_formatted = formatProcessingTime(progressData.totalProcessingTime);
                }

                if (fileObj.status === VALID_STATUSES.FAILED && progressData.error) {
                    enrichedFile.error = progressData.error;
                    enrichedFile.failed_at = progressData.failedAt;
                }

                if (fileObj.status === VALID_STATUSES.PROCESSING && progressData.processingStarted) {
                    enrichedFile.processing_started = progressData.processingStarted;
                    
                    const startTime = new Date(progressData.processingStarted).getTime();
                    const currentTime = Date.now();
                    const duration = currentTime - startTime;
                    enrichedFile.processing_duration_ms = duration;
                    enrichedFile.processing_duration_formatted = formatProcessingTime(duration);
                }
            } else {
                switch (fileObj.status) {
                    case VALID_STATUSES.UPLOADING:
                        enrichedFile.progress = 10;
                        break;
                    case VALID_STATUSES.PROCESSING:
                        enrichedFile.progress = 50;
                        break;
                    case VALID_STATUSES.READY:
                        enrichedFile.progress = 100;
                        break;
                    case VALID_STATUSES.FAILED:
                        enrichedFile.progress = 0;
                        break;
                }
            }

            enrichedFile.actions = {
                get_content: `http://localhost:4040/api/v1/files/${file.file_id}`,
                check_progress: `http://localhost:4040/api/v1/files/${file.file_id}/progress`,
                delete: `http://localhost:4040/api/v1/files/${file.file_id}`
            };

            return enrichedFile;
        });

        const totalPages = Math.ceil(totalFiles / limitCount);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        const statusSummary = enrichedFiles.reduce((acc, file) => {
            acc[file.status] = (acc[file.status] || 0) + 1;
            return acc;
        }, {});

        const totalSize = enrichedFiles.reduce((sum, file) => sum + (file.file_size || 0), 0);
        const totalRecords = enrichedFiles.reduce((sum, file) => sum + (file.total_records || 0), 0);

        res.status(200).json({
            success: true,
            message: "Files retrieved successfully",
            data: {
                files: enrichedFiles,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_files: totalFiles,
                    files_per_page: limitCount,
                    has_next_page: hasNextPage,
                    has_prev_page: hasPrevPage,
                    next_page: hasNextPage ? parseInt(page) + 1 : null,
                    prev_page: hasPrevPage ? parseInt(page) - 1 : null
                },
                summary: {
                    total_files: totalFiles,
                    status_distribution: statusSummary,
                    total_size_bytes: totalSize,
                    total_size_formatted: formatFileSize(totalSize),
                    total_records: totalRecords
                },
                filters: {
                    status: status || 'all',
                    sort_by: sort,
                    sort_order: order
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving files list",
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

const formatProcessingTime = (milliseconds) => {
    if (!milliseconds || milliseconds === 0) return '0ms';
    
    const seconds = Math.floor(milliseconds / 1000);
    const ms = milliseconds % 1000;
    
    if (seconds > 0) {
        return `${seconds}s ${ms}ms`;
    }
    return `${ms}ms`;
};

module.exports = {
    listFileController
};
