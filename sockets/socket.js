const socketIO = require("socket.io");
const http = require("http");
const https = require("https");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const onlyForHandshake = (middleware) => {
  return (req, res, next) => {
    const isHandshake = req._query.sid === undefined;
    if (isHandshake) {
      return middleware(req, res, next);
    } else {
      return next();
    }
  };
};

function getFileTypeFromURL(url) {
  const extension = url.split('.').pop().toLowerCase().split('?')[0].split('#')[0];

  const typeMap = {
    image: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'],
    video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
    audio: ['mp3', 'wav', 'ogg', 'm4a'],
    other: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
    other: ['zip', 'rar', '7z', 'tar', 'gz'],
  };

  for (const [type, extensions] of Object.entries(typeMap)) {
    if (extensions.includes(extension)) {
      return type;
    }
  }

  return 'unknown';
}

const validJWT = async (token) => {
  if (!token) {
    return undefined;
  }
  const user = await prisma.user.findUnique({
    where: { id: token },
  });
  return user;
};

const getSocketForId = (io, id) => {
  const sockets = Array.from(io.of("/chat").sockets.keys());
  const socketData = io.of("/chat").sockets;
  for (let soc of sockets) {
    const socData = socketData.get(soc);
    if (socData.user.id === id) {
      return socData;
    }
  }
  return undefined;
};

const setupSocketServer = (app) => {
  let server;

  if (!process.env.NODE_ENV || process.env.NODE_ENV === "development") {
    server = http.createServer(app);
  } else if (process.env.NODE_ENV === "production") {
    server = https.createServer(
      {
        key: fs.readFileSync(process.env.KEY_FILE),
        cert: fs.readFileSync(process.env.CERTIFICATE_FILE),
        requestCert: false,
        rejectUnauthorized: false,
      },
      app
    );
  }

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000"];

  const io = socketIO(server, {
    cors: {
      origin: "*",
    },
  });

  io.of("/chat").use(async (socket, next) => {
    let token = socket.handshake.auth.token;
    if (!token) {
      token = socket.handshake.headers["auth"];
      if (!token) {
        return next(Error("Socket Authentication Error"));
      }
    }

    const decodedToken = await validJWT(token);

    if (!decodedToken) {
      return next(Error("Socket Authentication Error"));
    }
    socket.user = decodedToken;
    next();
  });

  io.of("/chat").on("connection", async (socket) => {
    console.log("**********************************");
    console.log("User Connected with Id: ", socket.user?.email);
    console.log("**********************************");

    // Get and broadcast online users
    const users = await prisma.user.findMany();
    const userIds = users.map((user) => user.id);
    const onlineUsers = [];
    for (let userId of userIds) {
      const userSocket = getSocketForId(io, userId);
      if (userSocket) onlineUsers.push(userId);
    }

    socket.broadcast.emit("onlineUsers", { users: onlineUsers });

    socket.on("getOnlineUsers", async () => {
      const users = await prisma.user.findMany();
      const onlineUsers = users
        .filter((user) => getSocketForId(io, user.id))
        .map((user) => user.id);
      socket.emit("onlineUsers", { users: onlineUsers });
    });

    socket.on("sendMessage", async (data) => {
      const { chatId, groupId, message, files } = data;

      console.log("Triged", chatId)

      if (!message && (!files || files.length === 0)) {
        socket.emit("onMessageSend", { error: "Cannot send an empty message" });
        return;
      }

      try {
        if (chatId) {
          const chat = await prisma.chat.findUnique({
            where: { id: chatId },
            include: { sender: true, receiver: true },
          });

          if (
            chat &&
            (chat.senderId === socket.user.id ||
              chat.receiverId === socket.user.id)
          ) {
            // Create message
            const chatMessage = await prisma.message.create({
              data: {
                senderId: socket.user.id,
                text: message,
                sentTime: new Date(),
                readBy: [socket.user.id],
                timeRead: new Date(),
                chatId: chatId,
              },
            });

            // Update files
            if (files && files.length > 0) {
              await prisma.file.createMany({
                data: files?.map((url) => ({
                  type: getFileTypeFromURL(url),
                  url,
                  messageId: chatMessage.id,
                })),
              });
            }

            // Update chat last message
            await prisma.chat.update({
              where: { id: chatId },
              data: { lastMessageId: chatMessage.id },
            });

            // Get complete message data
            const newMessage = await prisma.message.findUnique({
              where: { id: chatMessage.id },
              include: { sender: true, files: true },
            });

            const receiverId =
              chat.senderId === socket.user.id
                ? chat.receiverId
                : chat.senderId;
            const receiverSocket = getSocketForId(io, receiverId);

            if (receiverSocket) {
              receiverSocket.emit("onChatMessageReceived", {
                message: newMessage,
                chat
              });
            }
            socket.emit("onMessageSend", { message: newMessage, chat });
          } else {
            socket.emit("onMessageSend", { error: "Invalid Chat" });
          }
        } else if (groupId) {
          const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: { include: { user: true } } },
          });

          if (group) {
            const groupMessage = await prisma.message.create({
              data: {
                senderId: socket.user.id,
                text: message,
                sentTime: new Date(),
                readBy: [socket.user.id],
                timeRead: new Date(),
                groupId: groupId,
              },
            });

            if (files && files.length > 0) {
              await prisma.file.createMany({
                data: files?.map((url) => ({
                  type: getFileTypeFromURL(url),
                  url,
                  messageId: groupMessage.id,
                })),
              });
            }

            await prisma.group.update({
              where: { id: groupId },
              data: { lastMessageId: groupMessage.id },
            });

            const newMessage = await prisma.message.findUnique({
              where: { id: groupMessage.id },
              include: { sender: true, files: true },
            });

            for (const member of group.members) {
              if (member.userId === socket.user.id) continue;
              const memberSocket = getSocketForId(io, member.userId);
              if (memberSocket) {
                memberSocket.emit("onChatMessageReceived", {
                  message: newMessage,
                  group
                });
              }
            }
            socket.emit("onMessageSend", { message: newMessage, group });
          }
        } else {
          socket.emit("onMessageSend", { error: "Invalid Chat/Group ID" });
        }
      } catch (error) {
        console.error("Message send error:", error);
        socket.emit("onMessageSend", { error: "Server error" });
      }
    });

    socket.on("markRead", async (data) => {
      const { messageId } = data;
      try {
        const message = await prisma.message.findUnique({
          where: { id: messageId },
        });

        if (message) {
          if (message.chatId) {
            await prisma.message.update({
              where: { id: messageId },
              data: {
                readBy: { set: [socket.user.id] },
                timeRead: new Date(),
              },
            });
          } else if (message.groupId) {
            await prisma.message.update({
              where: { id: messageId },
              data: {
                readBy: { push: socket.user.id },
                timeRead: new Date(),
              },
            });
          }
          socket.emit("onMarkRead", {
            message: await prisma.message.findUnique({
              where: { id: messageId },
            }),
          });
        }
      } catch (error) {
        console.error("Mark read error:", error);
        socket.emit("onMarkRead", { error: "Server error" });
      }
    });

    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.user.email);
      const users = await prisma.user.findMany();
      const onlineUsers = users
        .filter((user) => getSocketForId(io, user.id))
        .map((user) => user.id);
      socket.broadcast.emit("onlineUsers", { users: onlineUsers });
    });
  });

  console.log("Server Listening on Port: ", process.env.PORT || 3001);
  server.listen(process.env.PORT || 3001);
};

module.exports = {
  setupSocketServer,
};
