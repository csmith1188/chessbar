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

body {
    font-family: sans-serif;
    margin: 0;
    background: #f2f2f2;
  }
  






  io.on("connection", socket => {
    console.log("a user connected");
    
    socket.on("chat message", msg => {
      io.emit("chat message", msg); // send to everyone
    });
  
    socket.on("disconnect", () => {
      console.log("user disconnected");
    });
  });




  /* Small floating chat box in corner */
  #chat-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 260px;
    height: 320px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  #chat-header {
    background: #0078ff;
    color: white;
    text-align: center;
    padding: 8px;
    font-weight: bold;
  }
  
  #messages {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    font-size: 0.9em;
  }
  
  #chat-form {
    display: flex;
    border-top: 1px solid #ddd;
  }
  
  #message-input {
    flex: 1;
    padding: 6px;
    border: none;
    outline: none;
  }
  
  #chat-form button {
    background: #0078ff;
    border: none;
    color: white;
    padding: 0 10px;
    cursor: pointer;
  }
  
  #chat-form button:hover {
    background: #005fcc;
  }









socket.emit('chat messages', )