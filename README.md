# 🃏 Skip-Bo — Карточная игра

Полноценная веб-игра Skip-Bo с двумя режимами: против компьютера и онлайн с другим игроком. Оптимизирована для мобильных устройств и работы через Telegram-бота.

---

## 📁 Структура проекта

```
skipbo/
├── server.js          — Основной сервер (Express + Socket.io)
├── package.json       — Зависимости
├── src/
│   └── gameLogic.js   — Логика игры Skip-Bo
└── public/
    └── index.html     — Игровой интерфейс (мобильный)
```

---

## 🚀 Как задеплоить на Render.com

### Шаг 1 — Загрузить на GitHub

1. Зайдите на [github.com](https://github.com) и создайте аккаунт (если нет)
2. Нажмите **"New repository"** → назовите `skipbo-game` → нажмите **"Create repository"**
3. Загрузите все файлы проекта в репозиторий (через кнопку **"Add file" → "Upload files"**)

### Шаг 2 — Создать сервер на Render.com

1. Зайдите на [render.com](https://render.com) и создайте аккаунт
2. Нажмите **"New +"** → выберите **"Web Service"**
3. Подключите ваш GitHub-репозиторий `skipbo-game`
4. Заполните настройки:
   - **Name:** `skipbo-game` (или любое другое)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Нажмите **"Create Web Service"**
6. Подождите 2-3 минуты. Render выдаст вам ссылку вида:
   `https://skipbo-game.onrender.com`

---

## 🤖 Как создать Telegram-бота

### Шаг 1 — Создать бота

1. Откройте Telegram, найдите **@BotFather**
2. Напишите `/newbot`
3. Введите имя бота (например: `Skip-Bo Game`)
4. Введите username бота (например: `skipbo_game_bot`)
5. BotFather даст вам **токен** — сохраните его!

### Шаг 2 — Настроить Web App в боте

1. Напишите BotFather команду `/mybots`
2. Выберите вашего бота
3. Нажмите **"Bot Settings"** → **"Menu Button"** → **"Configure menu button"**
4. Введите ссылку вашего Render-сервера: `https://skipbo-game.onrender.com`
5. Введите текст кнопки: `🃏 Играть в Skip-Bo`

### Шаг 3 — Установить команды бота

Напишите BotFather: `/setcommands`, выберите бота, вставьте:
```
play - 🃏 Открыть игру Skip-Bo
help - ❓ Правила игры
```

### Шаг 4 — Настроить Telegram Web App (опционально — для лучшего опыта)

Создайте простой бот-сервер на Node.js. Создайте файл `bot.js`:

```javascript
const { Telegraf } = require('telegraf');
const bot = new Telegraf('ВАШ_ТОКЕН_ЗДЕСЬ');

const GAME_URL = 'https://skipbo-game.onrender.com'; // Ваша ссылка с Render

bot.command('start', (ctx) => {
  ctx.reply('Добро пожаловать в Skip-Bo! 🃏', {
    reply_markup: {
      inline_keyboard: [[
        { text: '🃏 Играть в Skip-Bo', web_app: { url: GAME_URL } }
      ]]
    }
  });
});

bot.command('play', (ctx) => {
  ctx.reply('Открываю игру...', {
    reply_markup: {
      inline_keyboard: [[
        { text: '🃏 Играть', web_app: { url: GAME_URL } }
      ]]
    }
  });
});

bot.command('help', (ctx) => {
  ctx.reply(
    '📖 *Правила Skip-Bo*\n\n' +
    '🎯 *Цель:* первым избавиться от своей стопки карт\n\n' +
    '🃏 *Ход игры:*\n' +
    '• Играйте карты из руки или верхнюю карту стопки\n' +
    '• Стопки сборки заполняются по порядку от 1 до 12\n' +
    '• Skip-Bo (джокер) заменяет любую карту\n' +
    '• Нельзя походить — сбросьте карту в свою стопку\n\n' +
    '🤖 *Режимы:*\n' +
    '• Против компьютера\n' +
    '• Онлайн с другом (поделитесь кодом комнаты)',
    { parse_mode: 'Markdown' }
  );
});

bot.launch();
console.log('Skip-Bo bot started!');
```

Установите зависимость: `npm install telegraf`

Запустите на Render как второй сервис (или на любом другом хостинге).

---

## 🎮 Как играть

1. **Выберите режим:**
   - 🤖 Против компьютера
   - 🌐 Онлайн (создайте комнату и поделитесь кодом с другом)

2. **Выберите размер стопки:** 10, 20 или 30 карт

3. **Игровой процесс:**
   - Нажмите на карту в руке (внизу) → выберите стопку сборки (зелёная подсветка)
   - Или нажмите на верхнюю карту своей стопки → выберите стопку сборки
   - Если не можете ходить — нажмите карту из руки → нажмите на одну из 4 своих стопок сброса
   - Победит тот, кто первым опустошит свою стопку!

---

## 🛠 Запуск локально (для тестирования)

```bash
npm install
npm start
# Откройте http://localhost:3000
```

---

## 📝 Технологии

- **Backend:** Node.js + Express + Socket.io
- **Frontend:** HTML5 + CSS3 + JavaScript (без фреймворков)
- **Деплой:** Render.com
- **Telegram:** Telegraf.js + Telegram Web Apps API
