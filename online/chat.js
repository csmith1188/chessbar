function attachChatSocket(io) {
  io.on('connection', (socket) => {
    socket.onChatMessage

  })
}
const socket = io();

const form = document.getElementById('chat-form');
const input = document.getElementById('message-input');
const messages = document.getElementById('messages');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value.trim()) {
    socket.emit('chat message', input.value);
    input.value = '';
  }
});

socket.on('chat message', (msg) => {
  const item = document.createElement('div');
  item.textContent = msg;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});

io.on("connection", socket => {
  console.log("a user connected");

  socket.on("chat message", msg => {
    io.emit("chat message", msg); // send to everyone
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

socket.emit('chat messages',)