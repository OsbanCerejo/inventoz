USE inventoz;

-- Add trackQuantity column to Products table
ALTER TABLE `Products` 
ADD COLUMN `trackQuantity` BOOLEAN DEFAULT FALSE NULL AFTER `image`;

-- Add minimumQuantity column to Products table
ALTER TABLE `Products` 
ADD COLUMN `minimumQuantity` INT NULL AFTER `trackQuantity`;

-- Add lowStockAlertSent column to track if alert has been sent
ALTER TABLE `Products` 
ADD COLUMN `lowStockAlertSent` BOOLEAN DEFAULT FALSE NULL AFTER `minimumQuantity`;

