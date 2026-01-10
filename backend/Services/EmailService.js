const axios = require('axios');

class EmailService {
  /**
   * Get Mailtrap API token from environment variables
   */
  static getApiToken() {
    return process.env.MAILTRAP_API_TOKEN || process.env.MAILTRAP_TOKEN;
  }

  /**
   * Check if email service is configured
   */
  static isConfigured() {
    const token = this.getApiToken();
    return !!token;
  }

  /**
   * Send low stock alert email using Mailtrap API
   * @param {Object} product - Product information
   * @param {string} recipientEmail - Email address to send alert to
   * @returns {Promise<boolean>} - Success status
   */
  static async sendLowStockAlert(product, recipientEmail) {
    try {
      const apiToken = this.getApiToken();
      
      if (!apiToken) {
        console.warn('Mailtrap API token not configured. Set MAILTRAP_API_TOKEN in .env file.');
        console.log('LOW STOCK ALERT (no email sent):', {
          sku: product.sku,
          itemName: product.itemName,
          brand: product.brand,
          currentQuantity: product.quantity,
          minimumQuantity: product.minimumQuantity,
          timestamp: new Date().toISOString()
        });
        return false;
      }

      // For Mailtrap, the "from" email must be verified in your Mailtrap account
      // If using Mailtrap's testing inbox, you can use any email format
      // For production, you need to verify the domain in Mailtrap's Sending Domains
      const emailFrom = process.env.EMAIL_FROM || 'mailtrap@demomail.trap';
      const emailFromName = process.env.EMAIL_FROM_NAME || 'Inventoz Inventory System';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
            .product-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #dc3545; }
            .label { font-weight: bold; color: #666; }
            .value { color: #333; }
            .quantity-low { color: #dc3545; font-weight: bold; font-size: 1.2em; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>⚠️ Low Stock Alert</h2>
            </div>
            <div class="content">
              <p>This is an automated alert to notify you that a product has fallen below its minimum quantity threshold.</p>
              
              <div class="product-info">
                <p><span class="label">SKU:</span> <span class="value">${product.sku}</span></p>
                <p><span class="label">Brand:</span> <span class="value">${product.brand}</span></p>
                <p><span class="label">Item Name:</span> <span class="value">${product.itemName}</span></p>
                <p><span class="label">Current Quantity:</span> <span class="value quantity-low">${product.quantity}</span></p>
                <p><span class="label">Minimum Quantity:</span> <span class="value">${product.minimumQuantity}</span></p>
                ${product.location ? `<p><span class="label">Location:</span> <span class="value">${product.location}</span></p>` : ''}
              </div>

              <p><strong>Action Required:</strong> Please review the inventory and consider restocking this product.</p>
              
              <div class="footer">
                <p>This is an automated message from Inventoz Inventory Management System.</p>
                <p>Timestamp: ${new Date().toLocaleString()}</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Low Stock Alert

Product Details:
- SKU: ${product.sku}
- Brand: ${product.brand}
- Item Name: ${product.itemName}
- Current Quantity: ${product.quantity}
- Minimum Quantity: ${product.minimumQuantity}
${product.location ? `- Location: ${product.location}` : ''}

Action Required: Please review the inventory and consider restocking this product.

This is an automated message from Inventoz Inventory Management System.
Timestamp: ${new Date().toLocaleString()}
      `;

      const requestBody = {
        from: {
          email: emailFrom,
          name: emailFromName
        },
        to: [
          {
            email: recipientEmail
          }
        ],
        subject: `Low Stock Alert: ${product.itemName} (${product.sku})`,
        html: htmlContent,
        text: textContent
      };

      const response = await axios.post(
        'https://send.api.mailtrap.io/api/send',
        requestBody,
        {
          headers: {
            'Api-Token': apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Low stock alert email sent successfully via Mailtrap API:', response.data);
      return true;
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      console.error('Error sending low stock alert email:', errorDetails);
      console.error('Full error response:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      // Log helpful troubleshooting info
      if (error.response?.status === 401) {
        console.error('Unauthorized error. Please check:');
        console.error('1. API token is correct in .env file');
        console.error('2. The "From" email domain is verified in Mailtrap');
        console.error('3. API token has sending permissions enabled');
      }
      
      return false;
    }
  }

  /**
   * Test email configuration using Mailtrap API
   * @param {string} testEmail - Email address to send test email to
   * @returns {Promise<boolean>} - Success status
   */
  static async sendTestEmail(testEmail) {
    try {
      const apiToken = this.getApiToken();
      
      if (!apiToken) {
        console.error('Mailtrap API token not configured. Please set MAILTRAP_API_TOKEN in .env file.');
        return false;
      }

      // For Mailtrap, the "from" email must be verified in your Mailtrap account
      const emailFrom = process.env.EMAIL_FROM || 'mailtrap@demomail.trap';
      const emailFromName = process.env.EMAIL_FROM_NAME || 'Inventoz Inventory System';

      const requestBody = {
        from: {
          email: emailFrom,
          name: emailFromName
        },
        to: [
          {
            email: testEmail
          }
        ],
        subject: 'Test Email from Inventoz',
        html: '<p>This is a test email from Inventoz Inventory Management System.</p><p>If you received this email, your Mailtrap API configuration is working correctly.</p>',
        text: 'This is a test email from Inventoz Inventory Management System. If you received this email, your Mailtrap API configuration is working correctly.'
      };

      const response = await axios.post(
        'https://send.api.mailtrap.io/api/send',
        requestBody,
        {
          headers: {
            'Api-Token': apiToken,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Test email sent successfully via Mailtrap API:', response.data);
      return true;
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      console.error('Error sending test email:', errorDetails);
      console.error('Full error response:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      if (error.response?.status === 401) {
        console.error('Unauthorized error. Please check:');
        console.error('1. API token is correct in .env file');
        console.error('2. The "From" email domain is verified in Mailtrap');
        console.error('3. API token has sending permissions enabled');
      }
      
      return false;
    }
  }
}

module.exports = EmailService;
