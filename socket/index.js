module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    socket.on('send_message', (data) => {
      // data: { toUserId, content, fromUserId }
      io.to(data.toUserId).emit('receive_message', data);
    });

    socket.on('join', (userId) => {
      socket.join(userId);
    });

    socket.on('disconnect', () => {
      console.log('Usuario desconectado:', socket.id);
    });
  });
}; 