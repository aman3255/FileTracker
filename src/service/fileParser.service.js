const fs = require("fs");
const csv = require("csv-parser");
const xlsx = require("xlsx");

const fileParserService = async (filePath, filename) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("File not found");
    }

    let parsedContent = [];

    if (filename.endsWith(".csv")) {
      const data = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on("data", (row) => data.push(row))
          .on("end", () => {
            parsedContent = data;
            resolve();
          })
          .on("error", reject);
      });
    } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      parsedContent = sheetData;
    } else {
      throw new Error("Unsupported file type. Only CSV and Excel files are allowed.");
    }

    return parsedContent;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  fileParserService,
};
