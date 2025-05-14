require("dotenv").config();
const express = require("express");
const path = require("path");
const bot = require("./bot");

const WEBHOOK_PATH = `/qrbot`;
const PORT = process.env.PORT || 3001;
const URL = process.env.APP_URL;

const app = express();
app.use(express.json());

app.use(bot.webhookCallback(WEBHOOK_PATH));

app.use("/qrapp", express.static(path.join(__dirname, "../public")));

app.post("/sendtouser", async (req, res) => {
  let { user_id, data } = req.body;
  text = `App code: ${data}`;

  const message = await bot.telegram.sendMessage(user_id, text);

  if (!message.entities) {
    bot.telegram.editMessageText(user_id, message.message_id, null, text, {
      entities: [
        {
          offset: text.indexOf(data),
          length: data.length,
          type: "code",
        },
      ],
    });
  }

  res.sendStatus(200);
});

bot.telegram
  .setWebhook(`${URL}${WEBHOOK_PATH}`)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server ${PORT}-portda, webhook URL: ${URL}${WEBHOOK_PATH}`);
    });
  })
  .catch(console.error);
