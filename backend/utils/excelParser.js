const XLSX = require('xlsx');

/**
 * Smart Excel parser that can handle variable headers and content
 */
class ExcelParser {
    /**
     * Check if a value looks like a UPC/barcode
     * @param {any} value - Value to check
     * @returns {boolean} - Whether the value looks like a UPC
     */
    static isUPC(value) {
        if (!value) return false;
        const str = String(value).trim();
        
        // Common UPC patterns:
        // - 12-13 digits
        // - Starts with 0-9
        // - May contain letters and numbers (for custom codes)
        // - Usually between 8-14 characters
        return /^[0-9A-Za-z]{8,14}$/.test(str);
    }

    /**
     * Check if a value looks like a price
     * @param {any} value - Value to check
     * @returns {boolean} - Whether the value looks like a price
     */
    static isPrice(value) {
        if (value === null || value === undefined || value === '') return false;
        
        // Convert to number if possible
        const num = Number(value);
        if (isNaN(num)) return false;
        
        // Price should be a positive number
        return num >= 0;
    }

    /**
     * Find the main header row in an Excel sheet
     * @param {Object} worksheet - XLSX worksheet object
     * @param {Object} options - Configuration options
     * @param {number} options.maxRowsToCheck - Maximum number of rows to check for headers (default: 20)
     * @returns {number} - The row index where headers were found (0-based)
     */
    static findHeaderRow(worksheet, options = {}) {
        const { maxRowsToCheck = 20 } = options;

        // Convert worksheet to array of arrays
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const rows = [];
        
        for (let R = range.s.r; R <= Math.min(range.e.r, maxRowsToCheck); R++) {
            const row = [];
            for (let C = range.s.c; C <= range.e.c; C++) {
                const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
                row.push(cell ? cell.v : null);
            }
            rows.push(row);
        }

        // Debug: Print first few rows
        console.log('\nFirst few rows of the sheet:');
        rows.slice(0, 10).forEach((row, index) => {
            console.log(`Row ${index}:`, row.filter(cell => cell !== null));
        });

        // Define patterns for product-related columns
        const productPatterns = [
            // UPC/EAN/Barcode patterns
            { pattern: /^(UPC|EAN|Barcode|Bar Code|Bar-Code|SKU|Code|Item Code|Product Code|Item Number|Product Number|ID|Item ID|Product ID)$/i, weight: 3 },
            // Product name patterns
            { pattern: /^(Product|Item|Name|Product Name|Item Name|Description|Product Description|Item Description|Title|Product Title|Item Title)$/i, weight: 3 },
            // Price patterns
            { pattern: /^(Price|Cost|Retail|Wholesale|MSRP|List Price|Selling Price|Unit Price|Price Each|Price Per Unit|Price Per Item)$/i, weight: 3 },
            // Quantity patterns
            { pattern: /^(Quantity|Qty|Amount|Stock|Inventory|Available|Availability|In Stock|On Hand|Count|Number of Items)$/i, weight: 2 },
            // Brand/Manufacturer patterns
            { pattern: /^(Brand|Manufacturer|Maker|Producer|Vendor|Supplier|Company|Manufacturer Name|Brand Name)$/i, weight: 2 },
            // Category patterns
            { pattern: /^(Category|Type|Group|Class|Department|Section|Division|Family|Line|Series)$/i, weight: 2 }
        ];

        // Find the row that looks most like headers by analyzing patterns
        let bestRowIndex = -1;
        let bestScore = -1;
        let rowScores = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            let score = 0;
            let nonEmptyCells = 0;
            let matchedPatterns = new Set();
            let hasNumericValues = false;
            let hasPriceLikeValues = false;

            // Analyze the row's characteristics
            for (const cell of row) {
                if (cell === null || cell === '') continue;
                
                nonEmptyCells++;
                const cellStr = String(cell).trim();

                // Check for numeric values
                if (!isNaN(cell) && cell !== '') {
                    hasNumericValues = true;
                }

                // Check for price-like values
                if (cellStr.match(/^\$?\d+(\.\d{2})?$/)) {
                    hasPriceLikeValues = true;
                }

                // Check for product-related patterns
                for (const { pattern, weight } of productPatterns) {
                    if (pattern.test(cellStr)) {
                        score += weight;
                        matchedPatterns.add(pattern.toString());
                    }
                }
            }

            // Skip rows with too few non-empty cells
            if (nonEmptyCells < 2) continue;

            // Calculate final score
            let finalScore = score;

            // Penalize rows with numeric or price-like values
            if (hasNumericValues) finalScore -= 2;
            if (hasPriceLikeValues) finalScore -= 2;

            // Penalize rows that are too early in the file
            if (i < 2) {
                finalScore *= 0.5;
            }

            // Store score for debugging
            rowScores.push({
                rowIndex: i,
                score: finalScore,
                nonEmptyCells,
                matchedPatterns: Array.from(matchedPatterns),
                hasNumericValues,
                hasPriceLikeValues,
                values: row.filter(cell => cell !== null)
            });
            
            if (finalScore > bestScore) {
                bestScore = finalScore;
                bestRowIndex = i;
            }
        }

        // Debug: Print all row scores
        console.log('\nRow Scores:');
        rowScores.sort((a, b) => b.score - a.score).forEach((row, index) => {
            console.log(`\nRow ${row.rowIndex} (Score: ${row.score.toFixed(2)}):`);
            console.log(`  Non-empty cells: ${row.nonEmptyCells}`);
            console.log(`  Matched patterns:`, row.matchedPatterns);
            console.log(`  Has numeric values: ${row.hasNumericValues}`);
            console.log(`  Has price-like values: ${row.hasPriceLikeValues}`);
            console.log(`  Values:`, row.values);
        });

        // Debug: Print the best row found
        if (bestRowIndex !== -1) {
            console.log('\nBest header row found:');
            console.log(rows[bestRowIndex].filter(cell => cell !== null));
            console.log('Score:', bestScore);
        }

        return bestRowIndex;
    }

    /**
     * Analyze column content to determine if it's UPC or price
     * @param {Array} rows - Array of row objects
     * @param {string} columnName - Name of the column to analyze
     * @returns {Object} - Analysis results
     */
    static analyzeColumn(rows, columnName) {
        let upcCount = 0;
        let priceCount = 0;
        let totalCount = 0;
        let sampleValues = new Set();

        rows.forEach(row => {
            const value = row[columnName];
            if (value !== null && value !== undefined && value !== '') {
                totalCount++;
                if (this.isUPC(value)) upcCount++;
                if (this.isPrice(value)) priceCount++;
                
                // Keep track of sample values for debugging
                if (sampleValues.size < 5) {
                    sampleValues.add(String(value));
                }
            }
        });

        return {
            columnName,
            upcScore: upcCount / totalCount,
            priceScore: priceCount / totalCount,
            totalCount,
            sampleValues: Array.from(sampleValues)
        };
    }

    /**
     * Parse Excel file with smart header detection
     * @param {string} filePath - Path to the Excel file
     * @param {Object} options - Configuration options
     * @returns {Object} - Parsed data with headers and rows
     */
    static parseExcel(filePath, options = {}) {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Debug: Print sheet info
        console.log('\nSheet name:', sheetName);
        console.log('Sheet range:', worksheet['!ref']);

        // Find the header row
        const headerRowIndex = this.findHeaderRow(worksheet, options);
        if (headerRowIndex === -1) {
            throw new Error('Could not find valid headers in the Excel file');
        }

        // Get headers
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        const headers = [];
        let lastNonEmptyColumn = range.s.c;

        // First pass: find the last non-empty column
        for (let C = range.s.c; C <= range.e.c; C++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: headerRowIndex, c: C })];
            if (cell && cell.v !== null && cell.v !== '') {
                lastNonEmptyColumn = C;
            }
        }

        // Second pass: get headers only up to the last non-empty column
        for (let C = range.s.c; C <= lastNonEmptyColumn; C++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: headerRowIndex, c: C })];
            headers.push(cell ? String(cell.v).trim() : `Column${C + 1}`);
        }

        // Get data rows
        const rows = [];
        for (let R = headerRowIndex + 1; R <= range.e.r; R++) {
            const row = {};
            let hasData = false;

            for (let C = range.s.c; C <= lastNonEmptyColumn; C++) {
                const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
                const value = cell ? cell.v : null;
                if (value !== null && value !== '') hasData = true;
                row[headers[C]] = value;
            }

            if (hasData) rows.push(row);
        }

        // Analyze each column to determine if it's UPC or price
        const columnAnalysis = headers.map(header => this.analyzeColumn(rows, header));
        
        // Find the best UPC and price columns
        const upcColumn = columnAnalysis.reduce((best, current) => 
            current.upcScore > best.upcScore ? current : best
        );
        const priceColumn = columnAnalysis.reduce((best, current) => 
            current.priceScore > best.priceScore ? current : best
        );

        // Create header mapping
        const headerMapping = {};
        if (upcColumn.upcScore > 0.5) {
            headerMapping[upcColumn.columnName] = 'upc';
        }
        if (priceColumn.priceScore > 0.5) {
            headerMapping[priceColumn.columnName] = 'price';
        }

        console.log('\nColumn Analysis:');
        columnAnalysis.forEach(analysis => {
            console.log(`\n${analysis.columnName}:`);
            console.log(`  UPC Score: ${(analysis.upcScore * 100).toFixed(1)}%`);
            console.log(`  Price Score: ${(analysis.priceScore * 100).toFixed(1)}%`);
            console.log(`  Total Values: ${analysis.totalCount}`);
            console.log(`  Sample Values: ${analysis.sampleValues.join(', ')}`);
        });

        return {
            headers,
            rows,
            headerRowIndex,
            headerMapping
        };
    }
}

module.exports = ExcelParser; 