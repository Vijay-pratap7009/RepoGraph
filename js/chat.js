/* ============================================================
   chat.js — Real-Time Messaging Client
   Connects to Socket.io and manages the chat widget UI
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof io === 'undefined') {
        console.warn('Socket.io client library not loaded. Chat disabled.');
        return;
    }

    // Connect to the Socket.io server (running on the same origin)
    const socket = io();

    // UI Elements
    const chatWidget = document.getElementById('chat-widget');
    const toggleBtn = document.getElementById('chat-toggle-btn');
    const toggleIcon = document.getElementById('chat-toggle-icon');
    const messagesContainer = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const usersCount = document.getElementById('chat-users-count');

    // State
    let isCollapsed = true;

    // Toggle Chat Widget
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent bubbling to header
        toggleChat();
    });

    // Also toggle when clicking the header area (excluding buttons)
    document.querySelector('.chat-header').addEventListener('click', (e) => {
        if (e.target.closest('.chat-controls')) return;
        toggleChat();
    });

    function toggleChat() {
        isCollapsed = !isCollapsed;
        if (isCollapsed) {
            chatWidget.classList.add('collapsed');
            toggleIcon.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>'; // arrow down
        } else {
            chatWidget.classList.remove('collapsed');
            toggleIcon.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>'; // arrow up
            setTimeout(() => chatInput.focus(), 300);
            scrollToBottom();
        }
    }

    // Get current username
    function getUsername() {
        // Try to get from the search input first, or fallback
        const input = document.getElementById('username-input');
        if (input && input.value.trim() !== '') {
            return input.value.trim();
        }
        return 'Anonymous';
    }

    // Send Message
    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        const msgData = {
            text: text,
            username: getUsername()
        };

        socket.emit('chat-message', msgData);
        chatInput.value = '';
        chatInput.focus();
    }

    sendBtn.addEventListener('click', sendMessage);

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Socket Events
    socket.on('connect', () => {
        // Clear "Connecting..." message
        messagesContainer.innerHTML = '';
        appendSystemMessage('Connected to server! 🚀');
        chatInput.disabled = false;
        sendBtn.disabled = false;
    });

    socket.on('disconnect', () => {
        appendSystemMessage('Disconnected from server. Retrying...', true);
        chatInput.disabled = true;
        sendBtn.disabled = true;
    });

    socket.on('system-message', (data) => {
        appendSystemMessage(data.text);
    });

    socket.on('chat-message', (data) => {
        appendUserMessage(data);
    });

    // Helpers
    function appendSystemMessage(text, isError = false) {
        const div = document.createElement('div');
        div.className = 'chat-system-msg';
        div.textContent = text;
        if (isError) div.style.color = '#ff6b6b';
        messagesContainer.appendChild(div);
        scrollToBottom();
    }

    function appendUserMessage(data) {
        const isSelf = data.username.toLowerCase() === getUsername().toLowerCase();
        
        const wrapper = document.createElement('div');
        wrapper.className = `chat-message ${isSelf ? 'self' : 'other'}`;

        // Format time safely
        let timeStr = '';
        try {
            const date = new Date(data.timestamp);
            timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch(e) {}

        const authorDiv = document.createElement('div');
        authorDiv.className = 'msg-author';
        authorDiv.textContent = data.username;

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'msg-bubble';
        bubbleDiv.textContent = data.text; // Text content protects against XSS vs innerHTML

        const timeDiv = document.createElement('div');
        timeDiv.className = 'msg-time';
        timeDiv.textContent = timeStr;

        if (!isSelf) wrapper.appendChild(authorDiv);
        wrapper.appendChild(bubbleDiv);
        wrapper.appendChild(timeDiv);

        messagesContainer.appendChild(wrapper);
        
        if (!isCollapsed) {
            scrollToBottom();
        }
    }

    function scrollToBottom() {
        // slightly delayed to allow DOM update
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 10);
    }
});
