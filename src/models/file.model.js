const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
    {
        file_id: {
            type: String,
            required: true,
            unique: true
        },
        filename: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ["uploading", "processing", "ready", "failed"],
            default: "uploading",
        },
        created_at: {
            type: Date,
            default: Date.now
        },
        parsedContent: [
            {
                type: mongoose.Schema.Types.Mixed
            }
        ],
    }
);

const FileModel = mongoose.model("File", fileSchema);

module.exports = FileModel;
