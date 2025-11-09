const express = require('express');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Конфигурация Multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Ваш токен бота (замените на реальный)
const BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';

// Функция для отправки фото боту
async function sendPhotoToBot(chatId, photoPath, caption = '') {
  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', fs.createReadStream(photoPath));
    formData.append('caption', caption);

    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Ошибка отправки фото:', error.response?.data || error.message);
    throw error;
  }
}

// Маршрут для получения данных из Web App
app.post('/api/send-photo', upload.single('photo'), async (req, res) => {
  try {
    const { user_id, caption } = req.body;
    const photo = req.file;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!photo) {
      return res.status(400).json({ error: 'Photo is required' });
    }

    // Отправляем фото боту
    const result = await sendPhotoToBot(user_id, photo.path, caption);

    // Удаляем временный файл
    fs.unlinkSync(photo.path);

    res.json({ 
      success: true, 
      message: 'Фото успешно отправлено!',
      message_id: result.result.message_id 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при отправке фото' 
    });
  }
});

// Маршрут для обработки base64 изображений
app.post('/api/send-photo-base64', async (req, res) => {
  try {
    const { user_id, photo_data, caption } = req.body;

    if (!user_id || !photo_data) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and photo data are required' 
      });
    }

    // Конвертируем base64 в buffer
    const base64Data = photo_data.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Отправляем фото через Telegram Bot API
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
      {
        chat_id: user_id,
        photo: imageBuffer.toString('base64'),
        caption: caption || 'Фото из Web App'
      }
    );

    res.json({ 
      success: true, 
      message: 'Фото успешно отправлено!',
      message_id: response.data.result.message_id 
    });
  } catch (error) {
    console.error('Ошибка:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при отправке фото' 
    });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
