const msgInput = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const messages = document.getElementById('messages');
const sidebar = document.getElementById('chat-sidebar');

let msgHistory = []
let prevSender

function renderMessages(history) {
    messages.innerHTML = '';
    history.forEach(({ sender, message }) => {
        renderMessage(sender, message)
    });
}

function renderMessage(sender, message) {
    const row = document.createElement('div');
    row.classList.add('message-row');
    row.classList.add(sender === me.displayName ? 'you' : 'other');

    let senderDiv

    // If me is not the sender and the previous message was not sent by the same person
    if (sender !== prevSender && sender !== me.displayName) {
        senderDiv = document.createElement('div');
        senderDiv.classList.add('sender');
        senderDiv.textContent = sender;
    }

    const bubble = document.createElement('div');
    bubble.classList.add('message');
    bubble.textContent = message;

    if (senderDiv) row.appendChild(senderDiv);
    row.appendChild(bubble);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
    
    prevSender = sender
}

socket.on('messageHistory', (h) => {
    msgHistory = h;
    renderMessages(h);
});


// Send message
sendBtn.onclick = () => {
    const text = msgInput.value.trim();
    if (text !== '') {
        socket.emit('chatMessage', text);
        msgInput.value = '';
    }
}

// Receive new messages
socket.on('chatMessage', (sender, message) => {
    renderMessage(sender, message)
});

// Update user list
socket.on('userList', (users) => {
    sidebar.innerHTML = '<h2>Users</h2>';
    users.forEach(u => {
        const p = document.createElement('p');
        p.textContent = u;
        sidebar.appendChild(p);
    });
});