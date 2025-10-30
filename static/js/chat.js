
const username = USERNAME; // comes from the EJS variable
socket.emit("setName", username);


socket.emit("setName", username);

const msgInput = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const messages = document.getElementById("messages");
const sidebar = document.getElementById("chat-sidebar");

// Send message
sendBtn.addEventListener("click", () => {
    const text = msgInput.value.trim();
    if (text !== "") {
        socket.emit("chatMessage", text);
        msgInput.value = "";
    }
});

// Receive new messages
socket.on("chatMessage", ({ name, message }) => {
    const row = document.createElement("div");
    row.classList.add("message-row");
    row.classList.add(name === username ? "you" : "other");

    const bubble = document.createElement("div");
    bubble.classList.add("message");
    bubble.textContent = `${name}: ${message}`;

    row.appendChild(bubble);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
});

// Update user list
socket.on("userList", (users) => {
    sidebar.innerHTML = "<h2>Users</h2>";
    users.forEach(u => {
        const p = document.createElement("p");
        p.textContent = u;
        sidebar.appendChild(p);
    });
});