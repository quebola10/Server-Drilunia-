// Controlador base para señalización WebRTC
exports.signal = (io) => {
  io.on('connection', (socket) => {
    socket.on('webrtc_signal', (data) => {
      // data: { to, from, signal }
      io.to(data.to).emit('webrtc_signal', data);
    });
    socket.on('join_call', (roomId) => {
      socket.join(roomId);
    });
  });
}; 