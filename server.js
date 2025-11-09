const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Создаем папку для логов если не существует
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Функции логирования (оставляем без изменений)
const logger = {
    info: (message, data = {}) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message,
            data,
            user_id: 1189539923
        };
        console.log(`[${logEntry.timestamp}] INFO: ${message}`, data || '');
        appendToLogFile(logEntry);
    },
    
    error: (message, error = null, data = {}) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            message,
            error: error ? {
                message: error.message,
                stack: error.stack,
                code: error.code
            } : null,
            data,
            user_id: 1189539923
        };
        console.error(`[${logEntry.timestamp}] ERROR: ${message}`, error || '', data || '');
        appendToLogFile(logEntry);
    },
    
    warn: (message, data = {}) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'WARN',
            message,
            data,
            user_id: 1189539923
        };
        console.warn(`[${logEntry.timestamp}] WARN: ${message}`, data || '');
        appendToLogFile(logEntry);
    },
    
    debug: (message, data = {}) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'DEBUG',
            message,
            data,
            user_id: 1189539923
        };
        console.debug(`[${logEntry.timestamp}] DEBUG: ${message}`, data || '');
        appendToLogFile(logEntry);
    }
};

// Функция для записи в файл логов
function appendToLogFile(logEntry) {
    try {
        const logFile = path.join(logsDir, `server-${new Date().toISOString().split('T')[0]}.log`);
        const logLine = JSON.stringify(logEntry) + '\n';
        fs.appendFileSync(logFile, logLine, 'utf8');
    } catch (fileError) {
        console.error('Failed to write to log file:', fileError);
    }
}

// ⭐ ВАЖНО: Настраиваем CORS для разрешения запросов с GitHub Pages
const corsOptions = {
    origin: [
        'https://your-username.github.io', // Замените на ваш GitHub Pages URL
        'http://localhost:3000',
        'http://localhost:8000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8000',
        'https://telegram-camera-bot-production.up.railway.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions)); // ⭐ Используем настройки CORS
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Middleware для логирования запросов
app.use((req, res, next) => {
    const start = Date.now();
    
    logger.info('Incoming HTTP Request', {
        method: req.method,
        url: req.url,
        origin: req.get('origin'),
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
    });

    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - start;
        
        logger.info('HTTP Response Sent', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            origin: req.get('origin')
        });
        
        originalSend.call(this, data);
    };

    next();
});

// Health check endpoint
app.get('/', (req, res) => {
    logger.info('Health check requested', { origin: req.get('origin') });
    res.json({ 
        status: 'OK', 
        user: 'Alexander Gorchakov',
        user_id: 1189539923,
        token: process.env.BOT_TOKEN ? 'SET' : 'MISSING',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        cors: 'ENABLED',
        allowed_origins: corsOptions.origin
    });
});

// Функция для очистки base64 данных
function cleanBase64Data(base64String) {
    if (!base64String) return null;
    
    const cleaned = base64String.replace(/^data:image\/[a-z]+;base64,/, '');
    
    const padding = cleaned.length % 4;
    if (padding !== 0) {
        return cleaned + '='.repeat(4 - padding);
    }
    
    return cleaned;
}

function isValidBase64(str) {
    try {
        const cleaned = cleanBase64Data(str);
        if (!cleaned) return false;
        
        if (cleaned.length % 4 !== 0) return false;
        
        Buffer.from(cleaned, 'base64');
        return true;
    } catch (error) {
        return false;
    }
}

// API endpoint for sending photos to Telegram
app.post('/api/send-photo', async (req, res) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    try {
        const { user_id, photo_data, caption } = req.body;
        
        logger.info('Photo send request received', {
            requestId,
            user_id,
            origin: req.get('origin'),
            hasPhotoData: !!photo_data,
            photoDataSize: photo_data ? Math.round(photo_data.length / 1024) + ' KB' : 'N/A'
        });

        // Validation
        if (!user_id || !photo_data) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing user_id or photo_data',
                requestId
            });
        }

        if (parseInt(user_id) !== 1189539923) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied. Wrong user ID.',
                requestId
            });
        }

        if (!process.env.BOT_TOKEN) {
            return res.status(500).json({
                success: false,
                error: 'BOT_TOKEN not configured on server',
                requestId
            });
        }

        if (!isValidBase64(photo_data)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid base64 photo data format',
                requestId
            });
        }

        const cleanedPhotoData = cleanBase64Data(photo_data);
        
        const FormData = require('form-data');
        const form = new FormData();
        
        form.append('chat_id', user_id);
        
        const imageBuffer = Buffer.from(cleanedPhotoData, 'base64');
        form.append('photo', imageBuffer, {
            filename: `photo-${Date.now()}.jpg`,
            contentType: 'image/jpeg'
        });
        
        if (caption) {
            form.append('caption', caption);
        }
        form.append('parse_mode', 'HTML');

        // Send photo to Telegram
        const telegramStart = Date.now();
        const response = await axios.post(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendPhoto`,
            form,
            {
                timeout: 30000,
                headers: {
                    ...form.getHeaders(),
                }
            }
        );

        const telegramDuration = Date.now() - telegramStart;
        
        logger.info('Photo sent successfully to Telegram', {
            requestId,
            messageId: response.data.result.message_id,
            telegramDuration: `${telegramDuration}ms`,
            totalDuration: `${Date.now() - startTime}ms`
        });
        
        res.json({ 
            success: true, 
            message_id: response.data.result.message_id,
            message: 'Фото успешно отправлено в Telegram!',
            requestId,
            duration: Date.now() - startTime
        });
        
    } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error('Failed to send photo to Telegram', error, {
            requestId,
            duration: `${duration}ms`,
            origin: req.get('origin')
        });
        
        let errorMessage = 'Unknown error occurred';
        let telegramError = null;
        
        if (error.response?.data) {
            telegramError = error.response.data;
            errorMessage = error.response.data.description || JSON.stringify(error.response.data);
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        res.status(500).json({ 
            success: false, 
            error: errorMessage,
            telegramError: telegramError,
            requestId,
            duration
        });
    }
});

// Additional endpoint to check bot status
app.get('/api/bot-status', async (req, res) => {
    const startTime = Date.now();
    
    try {
        logger.debug('Bot status check requested', { origin: req.get('origin') });
        
        if (!process.env.BOT_TOKEN) {
            return res.json({ 
                status: 'MISSING_TOKEN', 
                message: 'BOT_TOKEN not set' 
            });
        }

        const response = await axios.get(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getMe`,
            { timeout: 10000 }
        );

        logger.info('Bot status check successful', {
            botName: response.data.result.first_name,
            duration: `${Date.now() - startTime}ms`
        });

        res.json({ 
            status: 'ACTIVE', 
            bot: response.data.result,
            user: 'Alexander Gorchakov (1189539923)',
            duration: Date.now() - startTime
        });
    } catch (error) {
        logger.error('Bot status check failed', error, {
            duration: `${Date.now() - startTime}ms`
        });
        
        res.json({ 
            status: 'ERROR', 
            error: error.response?.data?.description || error.message,
            duration: Date.now() - startTime
        });
    }
});

// API для просмотра логов
app.get('/api/logs', (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const logFile = path.join(logsDir, `server-${today}.log`);
        
        if (!fs.existsSync(logFile)) {
            return res.json({
                status: 'NO_LOGS',
                message: 'No logs found for today',
                logFile
            });
        }

        const logs = fs.readFileSync(logFile, 'utf8')
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line))
            .reverse();

        res.json({
            status: 'SUCCESS',
            logFile,
            totalEntries: logs.length,
            logs: logs.slice(0, 100)
        });
        
    } catch (error) {
        logger.error('Failed to read logs', error);
        res.status(500).json({
            status: 'ERROR',
            error: error.message
        });
    }
});

// API для получения статистики
app.get('/api/stats', (req, res) => {
    try {
        const stats = {
            server: {
                startTime: new Date().toISOString(),
                uptime: Math.floor(process.uptime()) + ' seconds',
                memory: process.memoryUsage(),
                nodeVersion: process.version
            },
            user: {
                name: 'Alexander Gorchakov',
                id: 1189539923
            },
            environment: {
                nodeEnv: process.env.NODE_ENV || 'development',
                port: PORT,
                botTokenSet: !!process.env.BOT_TOKEN
            },
            cors: {
                enabled: true,
                origin: req.get('origin') || 'unknown'
            }
        };

        logger.info('Statistics requested', { 
            clientIp: req.ip,
            origin: req.get('origin')
        });
        
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get statistics', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
    logger.debug('Test endpoint called', { 
        clientIp: req.ip,
        origin: req.get('origin')
    });
    
    res.json({
        message: 'Server is working!',
        user_id: 1189539923,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        cors: 'enabled',
        origin: req.get('origin') || 'unknown',
        requestId: Math.random().toString(36).substr(2, 9)
    });
});

// Endpoint для проверки CORS
app.options('*', cors(corsOptions)); // ⭐ Обработка preflight запросов

// Start server
app.listen(PORT, '0.0.0.0', () => {
    logger.info('Server starting with CORS enabled', {
        port: PORT,
        user: 'Alexander Gorchakov',
        user_id: 1189539923,
        environment: process.env.NODE_ENV || 'development',
        botToken: process.env.BOT_TOKEN ? 'SET' : 'MISSING',
        cors: 'ENABLED'
    });
    
    console.log('🚀 === Telegram Camera Bot Server ===');
    console.log('📍 Server running on port:', PORT);
    console.log('👤 User: Alexander Gorchakov');
    console.log('🆔 User ID: 1189539923');
    console.log('🔑 BOT_TOKEN:', process.env.BOT_TOKEN ? '✅ SET' : '❌ MISSING');
    console.log('🌐 CORS: ✅ ENABLED');
    console.log('📡 Allowed Origins:', corsOptions.origin.join(', '));
    console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
    console.log('📧 Access URLs:');
    console.log('   Main: https://telegram-camera-bot-production.up.railway.app/');
    console.log('   Logs: https://telegram-camera-bot-production.up.railway.app/api/logs');
    console.log('   Stats: https://telegram-camera-bot-production.up.railway.app/api/stats');
    console.log('====================================');
});
