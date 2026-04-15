export const initSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("joinRoom", (conversationId) => {
      socket.join(conversationId);
    });

    socket.on("sendMessage", ({ conversationId, message }) => {
      io.to(conversationId).emit("receiveMessage", message);
    });

    socket.on("typing", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("userTyping", userId);
    });

    socket.on("stopTyping", ({ conversationId }) => {
      socket.to(conversationId).emit("userStoppedTyping");
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};