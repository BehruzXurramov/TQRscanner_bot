const { Telegraf } = require("telegraf");
const QRCode = require("qrcode");
const { Jimp } = require("jimp");
const qrCode = require("qrcode-reader");
const { message } = require("telegraf/filters");
const LJDB = require("ljdb");

const bot = new Telegraf(process.env.BOT_TOKEN);
const users = new LJDB("users");

bot.start(async (ctx) => {
  try {
    if (!Array.isArray(users.data)) {
      users.data = [];
      users.save();
    }

    if (!users.data.includes(ctx.from.id)) {
      users.data.push(ctx.from.id);
      users.save();
      await ctx.telegram.sendMessage(
        process.env.ADMIN_ID,
        `New user\nUsername: @${ctx.from.username || ""}\nName: ${
          ctx.from.first_name
        } ${ctx.from.last_name || ""}\nLang: ${ctx.from.language_code}`
      );
    }

    ctx.reply(
      "🇺🇿: Botga xush kelibsiz! \n🇷🇺: Добро пожаловать в бота! \n🇬🇧: Welcome to the bot!"
    );
  } catch (error) {
    console.log(error);
  }
});

bot.on(message("text"), async (ctx) => {
  try {
    const text = ctx.message.text;
    if (text.length > 1000)
      return ctx.reply(
        "🇺🇿: Matn juda uzun. Maksimal belgilar soni 1000 ta. \n🇷🇺: Текст слишком длинный. Максимальное количество символов — 1000. \n🇬🇧: The text is too long. The maximum number of characters is 1000."
      );
    const qrImage = await QRCode.toBuffer(text, { width: 300 });
    await ctx.replyWithPhoto({ source: qrImage });
  } catch (error) {
    console.log(error);
  }
});

bot.on(message("photo"), async (ctx) => {
  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
    const image = await Jimp.read(fileLink.href);
    const qr = new qrCode();
    const value = await new Promise((resolve, reject) => {
      qr.callback = (err, v) => (err ? reject(err) : resolve(v));
      qr.decode(image.bitmap);
    });

    if (value && value.result) {
      const code = value.result;
      const text = `Code: ${code}`;
      const message = await ctx.reply(text, {
        reply_parameters: { message_id: ctx.message.message_id },
      });

      if (!message.entities) {
        ctx.telegram.editMessageText(
          ctx.chat.id,
          message.message_id,
          null,
          text,
          {
            reply_parameters: { message_id: ctx.message.message_id },
            entities: [
              {
                offset: text.indexOf(code),
                length: code.length,
                type: "code",
              },
            ],
          }
        );
      }
    } else {
      ctx.reply(
        "🇺🇿: Rasmda QR kod topilmadi. \n🇷🇺: QR-код на изображении не найден. \n🇬🇧: No QR code was found in the image.",
        {
          reply_parameters: { message_id: ctx.message.message_id },
        }
      );
    }
  } catch (error) {
    ctx.reply(
      "🇺🇿: QR kodni o‘qishda xatolik yuz berdi. \n🇷🇺: Произошла ошибка при считывании QR-кода. \n🇬🇧: An error occurred while reading the QR code.",
      {
        reply_parameters: { message_id: ctx.message.message_id },
      }
    );
    console.log(error);
  }
});

bot.command("stc", (ctx) => {
  try {
    if (ctx.from.id == process.env.ADMIN_ID) {
      ctx.reply(`Total users: ${users.data.length}`);
    }
  } catch (error) {
    console.log(error);
  }
});

module.exports = bot;
