// server.js - Сервер для Telegram Web App с камерой

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['https://web.telegram.org', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// 🔐 ВАШ ТОКЕН БОТА (замените на новый после revoke!)
const BOT_TOKEN = '8344281396:AAGZ9-M2XRyPMHiI2akBSSIN7QAtRGDmLOY';

// Создаем папку для временных файлов
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Функция для отправки фото в Telegram
async function sendPhotoToBot(chatId, photoBuffer, caption = '') {
    try {
        const form = new FormData();
        
        form.append('chat_id', chatId);
        form.append('photo', photoBuffer, {
            filename: `photo-${Date.now()}.jpg`,
            contentType: 'image/jpeg'
        });
        
        if (caption) {
            form.append('caption', caption);
        }

        const response = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
            form,
            {
                headers: {
                    ...form.getHeaders(),
                },
            }
        );

        return response.data;
    } catch (error) {
        console.error('❌ Ошибка отправки фото:', error.response?.data || error.message);
        throw new Error(error.response?.data?.description || 'Ошибка отправки фото в Telegram');
    }
}

// Функция для отправки уведомления
async function sendNotification(chatId, message) {
    try {
        const response = await axios.post(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            }
        );
        return response.data;
    } catch (error) {
        console.error('❌ Ошибка отправки уведомления:', error.message);
    }
}

// Маршрут для отправки фото
app.post('/api/send-photo', async (req, res) => {
    try {
        const { user_id, photo_data, caption } = req.body;

        console.log('📨 Получен запрос на отправку фото от пользователя:', user_id);

        // Проверяем обязательные поля
        if (!user_id) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        if (!photo_data) {
            return res.status(400).json({
                success: false,
                error: 'Photo data is required'
            });
        }

        // Конвертируем base64 в Buffer
        const base64Data = photo_data.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        console.log('📸 Размер фото:', Math.round(imageBuffer.length / 1024) + ' KB');

        // Отправляем фото боту
        const result = await sendPhotoToBot(user_id, imageBuffer, caption);

        console.log('✅ Фото успешно отправлено! Message ID:', result.result.message_id);

        // Отправляем уведомление о успешной отправке
        await sendNotification(user_id, '📸 <b>Фото успешно получено!</b>\n\nСпасибо за использование нашего бота!');

        res.json({
            success: true,
            message: 'Фото успешно отправлено! 📸',
            message_id: result.result.message_id,
            chat_id: result.result.chat.id
        });

    } catch (error) {
        console.error('❌ Ошибка при обработке запроса:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Ошибка при отправке фото'
        });
    }
});

// Маршрут для проверки работы сервера
app.get('/', (req, res) => {
    res.json({
        status: 'Server is running! 🚀',
        message: 'Telegram Camera Web App Server',
        endpoints: {
            'GET /': 'Информация о сервере',
            'GET /bot-info': 'Информация о боте',
            'POST /api/send-photo': 'Отправка фото',
            'GET /health': 'Проверка здоровья сервера'
        },
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Маршрут для проверки бота
app.get('/bot-info', async (req, res) => {
    try {
        const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        
        res.json({
            success: true,
            bot: {
                id: response.data.result.id,
                name: response.data.result.first_name,
                username: response.data.result.username,
                is_bot: response.data.result.is_bot
            },
            bot_url: `https://t.me/${response.data.result.username}`,
            server_time: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Ошибка при проверке бота:', error.response?.data || error.message);
        
        res.status(500).json({
            success: false,
            error: 'Не удалось получить информацию о боте',
            details: error.response?.data?.description || error.message
        });
    }
});

// Маршрут для проверки здоровья сервера
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        bot_token_set: BOT_TOKEN && BOT_TOKEN !== '8344281396:AAGZ9-M2XRyPMHiI2akBSSIN7QAtRGDmLOY'
    });
});

// Маршрут для тестирования отправки сообщения
app.get('/test-message', async (req, res) => {
    try {
        const chatId = req.query.chat_id;
        
        if (!chatId) {
            return res.status(400).json({
                success: false,
                error: 'Добавьте параметр chat_id. Например: /test-message?chat_id=123456789'
            });
        }

        const result = await sendNotification(chatId, '🔧 <b>Тестовое сообщение от сервера!</b>\n\nЕсли вы видите это сообщение, сервер работает корректно! ✅');

        res.json({
            success: true,
            message: 'Тестовое сообщение отправлено!',
            result: result
        });

    } catch (error) {
        console.error('❌ Ошибка при тестовой отправке:', error.message);
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Обработка 404 ошибок
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Маршрут не найден',
        available_routes: {
            'GET /': 'Информация о сервере',
            'GET /bot-info': 'Информация о боте',
            'POST /api/send-photo': 'Отправка фото',
            'GET /health': 'Проверка здоровья',
            'GET /test-message': 'Тест отправки сообщения'
        }
    });
});

// Глобальная обработка ошибок
app.use((error, req, res, next) => {
    console.error('❌ Глобальная ошибка:', error);
    res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера'
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 СЕРВЕР TELEGRAM WEB APP ЗАПУЩЕН!');
    console.log('='.repeat(60));
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🌐 Локальный URL: http://localhost:${PORT}`);
    console.log(`📊 Статус сервера: http://localhost:${PORT}/`);
    console.log(`🤖 Инфо о боте: http://localhost:${PORT}/bot-info`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
    console.log('='.repeat(60));
    console.log('📸 Готов к приему фото из Web App!');
    console.log('='.repeat(60) + '\n');
});

// Грациозное завершение работы
process.on('SIGINT', () => {
    console.log('\n🛑 Сервер останавливается...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Сервер получает сигнал завершения...');
    process.exit(0);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Необработанное отклонение promise:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Необработанное исключение:', err);
    process.exit(1);
});