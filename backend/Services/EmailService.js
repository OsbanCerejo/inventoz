const nodemailer = require('nodemailer');

class EmailService {
  static transporter = null;

  /**
   * Initialize email transporter with Hostinger SMTP configuration
   */
  static initializeTransporter() {
    if (this.transporter) {
      return this.transporter;
    }

    const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com';
    const smtpPort = parseInt(process.env.SMTP_PORT || '465');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.warn('Email service not configured. SMTP credentials missing.');
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: true, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        rejectUnauthorized: false
      },
      debug: false, // Set to true for detailed SMTP logs
      logger: false // Set to true to log to console
    });

    return this.transporter;
  }

  /**
   * Verify SMTP connection (optional, can be called separately)
   */
  static async verifyConnection() {
    try {
      const transporter = this.initializeTransporter();
      if (!transporter) {
        return false;
      }
      await transporter.verify();
      console.log('✅ SMTP server connection verified successfully');
      return true;
    } catch (error) {
      console.error('❌ SMTP server connection failed:', error.message);
      return false;
    }
  }

  /**
   * Send low stock alert email using SMTP
   * @param {Object} product - Product information
   * @param {string} recipientEmail - Email address to send alert to
   * @returns {Promise<boolean>} - Success status
   */
  static async sendLowStockAlert(product, recipientEmail) {
    try {
      const transporter = this.initializeTransporter();
      
      if (!transporter) {
        console.warn('Email transporter not initialized. Skipping email send.');
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

      const emailFrom = process.env.EMAIL_FROM || process.env.SMTP_USER;
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
                <p><span class="label">Size:</span> <span class="value">${product.size || 'N/A'}</span></p>
                <p><span class="label">Strength:</span> <span class="value">${product.strength || 'N/A'}</span></p>
                <p><span class="label">Shade / Variant:</span> <span class="value">${product.shade || 'N/A'}</span></p>
                <p><span class="label">Condition:</span> <span class="value">${product.condition || 'N/A'}</span></p>
                <p><span class="label">UPC:</span> <span class="value">${product.upc || 'N/A'}</span></p>
                <p><span class="label">Tester:</span> <span class="value">${product.tester ? 'Yes' : 'No'}</span></p>
                <p><span class="label">Current Quantity:</span> <span class="value quantity-low">${product.quantity}</span></p>
                <p><span class="label">Minimum Quantity:</span> <span class="value">${product.minimumQuantity}</span></p>
                ${product.location ? `<p><span class="label">Location:</span> <span class="value">${product.location}</span></p>` : ''}
              </div>

              <p><strong>Action Required:</strong> Please review the inventory and consider restocking this product.</p>
              
              <div class="footer">
                <p>This is an automated message from Inventoz.</p>
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
- Size: ${product.size || 'N/A'}
- Strength: ${product.strength || 'N/A'}
- Shade / Variant: ${product.shade || 'N/A'}
- Condition: ${product.condition || 'N/A'}
- UPC: ${product.upc || 'N/A'}
- Tester: ${product.tester ? 'Yes' : 'No'}
- Current Quantity: ${product.quantity}
- Minimum Quantity: ${product.minimumQuantity}
${product.location ? `- Location: ${product.location}` : ''}

Action Required: Please review the inventory and consider restocking this product.

This is an automated message from Inventoz Inventory Management System.
Timestamp: ${new Date().toLocaleString()}
      `;

      const mailOptions = {
        from: `"${emailFromName}" <${emailFrom}>`,
        to: recipientEmail,
        subject: `Low Stock Alert: ${product.itemName} (${product.sku})`,
        html: htmlContent,
        text: textContent
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Low stock alert email accepted by SMTP server');
      console.log('   Message ID:', info.messageId);
      console.log('   To:', info.envelope.to);
      return true;
    } catch (error) {
      console.error('Error sending low stock alert email:', error.message);
      console.error('Full error:', {
        code: error.code,
        command: error.command,
        response: error.response
      });
      return false;
    }
  }

  /**
   * Test email configuration using SMTP
   * @param {string} testEmail - Email address to send test email to
   * @returns {Promise<boolean>} - Success status
   */
  static async sendTestEmail(testEmail) {
    try {
      const transporter = this.initializeTransporter();
      
      if (!transporter) {
        console.error('Email transporter not initialized. Please check your SMTP configuration in .env file.');
        return false;
      }

      const emailFrom = process.env.EMAIL_FROM || process.env.SMTP_USER;
      const emailFromName = process.env.EMAIL_FROM_NAME || 'Inventoz Inventory System';

      const mailOptions = {
        from: `"${emailFromName}" <${emailFrom}>`,
        to: testEmail,
        subject: 'Test Email from Inventoz',
        html: '<p>This is a test email from Inventoz Inventory Management System.</p><p>If you received this email, your SMTP configuration is working correctly.</p>',
        text: 'This is a test email from Inventoz Inventory Management System. If you received this email, your SMTP configuration is working correctly.'
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email accepted by SMTP server');
      console.log('   Message ID:', info.messageId);
      console.log('   Response:', info.response);
      console.log('   Envelope:', info.envelope);
      console.log('\n📧 Note: If you don\'t receive the email, check:');
      console.log('   1. Spam/Junk folder');
      console.log('   2. Email server logs for delivery status');
      console.log('   3. Recipient email provider might be blocking the email');
      return true;
    } catch (error) {
      console.error('Error sending test email:', error.message);
      console.error('Full error:', {
        code: error.code,
        command: error.command,
        response: error.response
      });
      return false;
    }
  }
}

module.exports = EmailService;
