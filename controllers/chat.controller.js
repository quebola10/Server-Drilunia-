const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.sendMessage = async (req, res) => {
  try {
    const { toUserId, content } = req.body;
    if (!toUserId || !content) {
      return res.status(400).json({ error: true, message: 'Faltan datos' });
    }
    const message = await prisma.message.create({
      data: {
        fromUserId: req.user.id,
        toUserId,
        content
      }
    });
    // Aquí puedes emitir el mensaje por socket.io si lo deseas
    res.status(201).json({ error: false, message: 'Mensaje enviado', data: message });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al enviar mensaje' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { fromUserId: req.user.id, toUserId: Number(userId) },
          { fromUserId: Number(userId), toUserId: req.user.id }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ error: false, messages });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener mensajes' });
  }
}; 