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

// Функции логирования
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

// ⭐ ВАЖНО: Настраиваем CORS для разрешения запросов со всех доменов
const corsOptions = {
    origin: function (origin, callback) {
        // Разрешаем все origins в development, в production можно ограничить
        if (!origin || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            // В production разрешаем только определенные домены
            const allowedOrigins = [
                'https://gor4akovya.github.io',
                'https://telegram-camera-bot-production.up.railway.app',
                'http://localhost:3000',
                'http://localhost:8000',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:8000'
            ];
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
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
        server: 'Telegram Camera Bot API',
        version: '1.0.0'
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
            logger.warn('Validation failed - missing data', {
                requestId,
                missing_user_id: !user_id,
                missing_photo_data: !photo_data
            });
            
            return res.status(400).json({ 
                success: false, 
                error: 'Missing user_id or photo_data',
                requestId
            });
        }

        // Ensure it's only for your user ID
        if (parseInt(user_id) !== 1189539923) {
            logger.warn('Unauthorized access attempt', {
                requestId,
                provided_user_id: user_id,
                expected_user_id: 1189539923,
                clientIp: req.ip
            });
            
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied. Wrong user ID.',
                requestId
            });
        }

        if (!process.env.BOT_TOKEN) {
            logger.error('BOT_TOKEN not configured', { requestId });
            return res.status(500).json({
                success: false,
                error: 'BOT_TOKEN not configured on server',
                requestId
            });
        }

        // Проверяем и чистим base64 данные
        if (!isValidBase64(photo_data)) {
            logger.error('Invalid base64 photo data', {
                requestId,
                dataStart: photo_data.substring(0, 50) + '...',
                dataLength: photo_data.length
            });
            
            return res.status(400).json({
                success: false,
                error: 'Invalid base64 photo data format',
                requestId
            });
        }

        const cleanedPhotoData = cleanBase64Data(photo_data);
        
        logger.debug('Cleaned photo data for sending', {
            requestId,
            originalLength: photo_data.length,
            cleanedLength: cleanedPhotoData.length,
            isBase64Valid: isValidBase64(photo_data)
        });

        // Создаем FormData для отправки файла
        const FormData = require('form-data');
        const form = new FormData();
        
        // Добавляем поля в форму
        form.append('chat_id', user_id);
        
        // Создаем buffer из base64 и добавляем как файл
        const imageBuffer = Buffer.from(cleanedPhotoData, 'base64');
        form.append('photo', imageBuffer, {
            filename: `photo-${Date.now()}.jpg`,
            contentType: 'image/jpeg'
        });
        
        if (caption) {
            form.append('caption', caption);
        }
        form.append('parse_mode', 'HTML');

        logger.debug('Sending photo to Telegram API using FormData', {
            requestId,
            imageBufferSize: imageBuffer.length + ' bytes',
            hasCaption: !!caption
        });

        // Send photo to Telegram используя FormData
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
            chatId: response.data.result.chat.id,
            telegramDuration: `${telegramDuration}ms`,
            totalDuration: `${Date.now() - startTime}ms`,
            method: 'FormData'
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
            user_id: req.body.user_id,
            photoDataSize: req.body.photo_data ? Math.round(req.body.photo_data.length / 1024) + ' KB' : 'N/A',
            errorDetails: error.response?.data
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
            details: 'Check if BOT_TOKEN is valid and bot is started with /start',
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
            logger.warn('Bot status check - BOT_TOKEN missing');
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
            botUsername: response.data.result.username,
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

// Новый endpoint для тестирования base64
app.post('/api/test-base64', (req, res) => {
    const { photo_data } = req.body;
    
    if (!photo_data) {
        return res.json({
            valid: false,
            error: 'No photo_data provided'
        });
    }
    
    const isValid = isValidBase64(photo_data);
    const cleaned = cleanBase64Data(photo_data);
    
    res.json({
        valid: isValid,
        originalLength: photo_data.length,
        cleanedLength: cleaned ? cleaned.length : 0,
        hasDataPrefix: photo_data.startsWith('data:'),
        sample: photo_data.substring(0, 100) + '...'
    });
});

// Endpoint для проверки CORS
app.options('*', cors(corsOptions));

// Обработка 404
app.use('*', (req, res) => {
    logger.warn('404 Not Found', {
        url: req.originalUrl,
        method: req.method,
        origin: req.get('origin')
    });
    
    res.status(404).json({
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET  /',
            'POST /api/send-photo',
            'GET  /api/bot-status',
            'GET  /api/logs',
            'GET  /api/stats',
            'GET  /api/test',
            'POST /api/test-base64'
        ]
    });
});

// Обработка непредвиденных ошибок
process.on('uncaughtException', (error) => {
    logger.error('UNCAUGHT EXCEPTION - Server will shutdown', error, {
        pid: process.pid,
        memory: process.memoryUsage()
    });
    
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('UNHANDLED PROMISE REJECTION', new Error(reason), {
        promise: promise.toString()
    });
});

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
    console.log('📡 Allowed Origins: All origins (development mode)');
    console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
    console.log('📊 Logs Directory:', logsDir);
    console.log('📧 Access URLs:');
    console.log('   Main: https://telegram-camera-bot-production.up.railway.app/');
    console.log('   Logs: https://telegram-camera-bot-production.up.railway.app/api/logs');
    console.log('   Stats: https://telegram-camera-bot-production.up.railway.app/api/stats');
    console.log('====================================');
});
