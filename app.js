const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const socketIO = require("socket.io");
const qrcode = require("qrcode");
const http = require("http");
const fs = require("fs");
const fileUpload = require("express-fileupload");
const port = process.env.PORT || 3001;
const tools = require("./logger.js");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
// const SESSION_FILE_PATH = "./session.json";
// let sessionCfg;
// if (fs.existsSync(SESSION_FILE_PATH)) {
//   sessionCfg = require(SESSION_FILE_PATH);
// }

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
  authStrategy: new LocalAuth({ clientId: "client-one" }),
});
client.initialize();
function delay() {
  return new Promise(function (resolve) {
    setTimeout(resolve, Math.random() * 100);
  });
}
function getStandardResponse(status, message, data) {
  return {
    status: status,
    message: message,
    data: data,
  };
}
app.use("/assets", express.static(__dirname + "/assets"));

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(
  fileUpload({
    debug: false,
  })
);
app.get("/", (req, res) => {
  res.sendFile("/routes/qrcode.html", {
    root: __dirname,
  });
});
app.post("/msg", async (req, res) => {
  const isRegisteredNumber = await checkRegisteredNumber(req.body.nomor);
  if (!isRegisteredNumber) {
    tools.logger.info("The number is not registered! " + req.body.nomor, {
      label: "CLASS2",
    });
    return res.status(422).json({
      status: false,
      message: "The number is not registered",
    });
  }
  const user = await client.getNumberId(req.body.nomor);
  const chatId = user._serialized;
  tools.logger.info(
    "Kirim Pesan ke Nomor " +
      req.body.nomor +
      " Dengan Pesan " +
      req.body.pesan,
    {
      label: "CLASS2",
    }
  );
  client.sendMessage(chatId, req.body.pesan);
  delay();
  return res.json(getStandardResponse(true, "Berhasil", []));
});

// Socket IO
io.on("connection", function (socket) {
  // socket.emit("message", "Connecting...");
  client.on("qr", (qr) => {
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit("qr", url);
      socket.emit("message", "QR Code received, scan please!");
      tools.logger.info("QR Code received, scan please!", {
        label: "CLASS2",
      });
      console.log(err);
    });
  });

  client.on("ready", () => {
    socket.emit("ready", "Whatsapp is ready!");
    socket.emit("message", "Whatsapp is ready!");
  });

  client.on("authenticated", () => {
    socket.emit("authenticated", "Whatsapp is authenticated!");
    socket.emit("message", "Whatsapp is authenticated!");
    console.log("AUTHENTICATED");
  });

  client.on("auth_failure", function (session) {
    tools.logger.info("Auth failure, restarting... " + session, {
      label: "CLASS2",
    });
    socket.emit("message", "Auth failure, restarting...");
  });

  client.on("disconnected", (reason) => {
    socket.emit("message", "Whatsapp is disconnected!");
    tools.logger.info("Whatsapp is disconnected! ", {
      label: "CLASS2",
    });

    client.destroy();
    client.initialize();
  });
});
// Socket IO

const checkRegisteredNumber = async function (number) {
  const isRegistered = await client.isRegisteredUser(number);
  return isRegistered;
};

server.listen(port, () => {
  console.log("LOCAL MODE => listening on *:" + port);
});
