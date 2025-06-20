const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Configurar transporter de email
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'localhost',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Enviar email de verificación
const sendVerificationEmail = async (email, code) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Drilunia" <${process.env.SMTP_FROM || 'noreply@drilunia.com'}>`,
      to: email,
      subject: 'Verifica tu cuenta de Drilunia',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Drilunia</h1>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Verifica tu cuenta</h2>
            
            <p style="color: #666; line-height: 1.6;">
              Gracias por registrarte en Drilunia. Para completar tu registro, 
              necesitamos verificar tu dirección de email.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
              <h3 style="color: #333; margin-bottom: 10px;">Tu código de verificación:</h3>
              <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; padding: 15px; background: #f0f0f0; border-radius: 5px;">
                ${code}
              </div>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Este código expirará en 10 minutos. Si no solicitaste este código, 
              puedes ignorar este email.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">
                Drilunia - Chat seguro y privado
              </p>
            </div>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email de verificación enviado a ${email}:`, info.messageId);
    
    return true;
  } catch (error) {
    logger.error('Error enviando email de verificación:', error);
    throw error;
  }
};

// Enviar email de recuperación de contraseña
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"Drilunia" <${process.env.SMTP_FROM || 'noreply@drilunia.com'}>`,
      to: email,
      subject: 'Recupera tu contraseña de Drilunia',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Drilunia</h1>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Recupera tu contraseña</h2>
            
            <p style="color: #666; line-height: 1.6;">
              Has solicitado restablecer tu contraseña. Haz clic en el botón 
              de abajo para crear una nueva contraseña.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Restablecer Contraseña
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Si no solicitaste restablecer tu contraseña, puedes ignorar este email. 
              Tu contraseña permanecerá sin cambios.
            </p>
            
            <p style="color: #666; font-size: 14px;">
              Este enlace expirará en 1 hora por razones de seguridad.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">
                Drilunia - Chat seguro y privado
              </p>
            </div>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email de recuperación enviado a ${email}:`, info.messageId);
    
    return true;
  } catch (error) {
    logger.error('Error enviando email de recuperación:', error);
    throw error;
  }
};

// Enviar email de bienvenida
const sendWelcomeEmail = async (email, username) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Drilunia" <${process.env.SMTP_FROM || 'noreply@drilunia.com'}>`,
      to: email,
      subject: '¡Bienvenido a Drilunia!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Drilunia</h1>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">¡Bienvenido, ${username}!</h2>
            
            <p style="color: #666; line-height: 1.6;">
              Tu cuenta ha sido verificada exitosamente. Ya puedes disfrutar de todas 
              las funcionalidades de Drilunia:
            </p>
            
            <ul style="color: #666; line-height: 1.8;">
              <li>💬 Chat privado y seguro</li>
              <li>📞 Llamadas de voz y video</li>
              <li>📁 Compartir archivos</li>
              <li>🔔 Notificaciones push</li>
              <li>🔒 Encriptación end-to-end</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Comenzar a usar Drilunia
              </a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">
                Drilunia - Chat seguro y privado
              </p>
            </div>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email de bienvenida enviado a ${email}:`, info.messageId);
    
    return true;
  } catch (error) {
    logger.error('Error enviando email de bienvenida:', error);
    throw error;
  }
};

// Enviar email de notificación
const sendNotificationEmail = async (email, subject, message) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Drilunia" <${process.env.SMTP_FROM || 'noreply@drilunia.com'}>`,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Drilunia</h1>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">${subject}</h2>
            
            <div style="color: #666; line-height: 1.6;">
              ${message}
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">
                Drilunia - Chat seguro y privado
              </p>
            </div>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email de notificación enviado a ${email}:`, info.messageId);
    
    return true;
  } catch (error) {
    logger.error('Error enviando email de notificación:', error);
    throw error;
  }
};

// Verificar configuración de email
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Configuración de email verificada correctamente');
    return true;
  } catch (error) {
    logger.error('Error en configuración de email:', error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendNotificationEmail,
  testEmailConfig
};
