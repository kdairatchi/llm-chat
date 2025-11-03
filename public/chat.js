/**
 * LLM Chat App Frontend
 *
 * Handles the chat UI interactions and communication with the backend API.
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Chat state
let chatHistory = [
        {
                role: "assistant",
                content:
                        "Hello! I'm your GreyScript programming assistant. I can help you write scripts, debug code, understand the GreyScript API, and optimize your Grey Hack gameplay. What would you like to know?",
        },
];
let isProcessing = false;

/**
 * Converts markdown text to HTML, handling code blocks and inline code
 */
function markdownToHtml(text) {
        let html = text;

        // First, extract and protect code blocks
        const codeBlocks = [];
        let codeBlockIndex = 0;

        // Find all code blocks and replace with placeholders
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                const language = lang || "text";
                const placeholder = `__CODE_BLOCK_${codeBlockIndex}__`;
                codeBlocks[codeBlockIndex] = {
                        placeholder: placeholder,
                        html: `<pre><code class="language-${language}">${escapeHtml(code.trim())}</code></pre>`
                };
                codeBlockIndex++;
                return placeholder;
        });

        // Now escape HTML in the remaining text
        html = html
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

        // Restore code blocks (they're already HTML-escaped)
        codeBlocks.forEach(block => {
                html = html.replace(block.placeholder, block.html);
        });

        // Convert inline code (but not inside code blocks which are already replaced)
        html = html.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

        // Convert bold (**text**) first
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Convert italic (*text*) - only match single asterisks
        html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');

        // Convert line breaks
        html = html.replace(/\n/g, "<br>");

        return html;
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text) {
        return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
}

// Auto-resize textarea as user types
userInput.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = this.scrollHeight + "px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
        }
});

// Send button click handler
sendButton.addEventListener("click", sendMessage);

/**
 * Sends a message to the chat API and processes the response
 */
async function sendMessage() {
        const message = userInput.value.trim();

        // Don't send empty messages
        if (message === "" || isProcessing) return;

        // Disable input while processing
        isProcessing = true;
        userInput.disabled = true;
        sendButton.disabled = true;

        // Add user message to chat
        addMessageToChat("user", message);

        // Clear input
        userInput.value = "";
        userInput.style.height = "auto";

        // Show typing indicator
        typingIndicator.classList.add("visible");

        // Add message to history
        chatHistory.push({ role: "user", content: message });

        try {
                // Create new assistant response element
                const assistantMessageEl = document.createElement("div");
                assistantMessageEl.className = "message assistant-message";
                assistantMessageEl.innerHTML = '<div class="message-content"></div>';
                chatMessages.appendChild(assistantMessageEl);

                // Scroll to bottom
                chatMessages.scrollTop = chatMessages.scrollHeight;

                // Send request to API
                const response = await fetch("/api/chat", {
                        method: "POST",
                        headers: {
                                "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                                messages: chatHistory,
                        }),
                });

                // Handle errors
                if (!response.ok) {
                        throw new Error("Failed to get response");
                }

                // Process streaming response
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let responseText = "";

                while (true) {
                        const { done, value } = await reader.read();

                        if (done) {
                                break;
                        }

                        // Decode chunk
                        const chunk = decoder.decode(value, { stream: true });

                        // Process SSE format
                        const lines = chunk.split("\n");
                        for (const line of lines) {
                                try {
                                        const jsonData = JSON.parse(line);
                                        if (jsonData.response) {
                                                // Append new content to existing text
                                                responseText += jsonData.response;
                                                assistantMessageEl.querySelector("p").textContent = responseText;

                                                // Scroll to bottom
                                                chatMessages.scrollTop = chatMessages.scrollHeight;
                                        }
                                } catch (e) {
                                        console.error("Error parsing JSON:", e);
                                }
                        }
                }

                // Add completed response to chat history
                chatHistory.push({ role: "assistant", content: responseText });
        } catch (error) {
                console.error("Error:", error);
                addMessageToChat(
                        "assistant",
                        "Sorry, there was an error processing your request.",
                );
        } finally {
                // Hide typing indicator
                typingIndicator.classList.remove("visible");

                // Re-enable input
                isProcessing = false;
                userInput.disabled = false;
                sendButton.disabled = false;
                userInput.focus();
        }
}

/**
 * Helper function to add message to chat
 */
function addMessageToChat(role, content) {
        const messageEl = document.createElement("div");
        messageEl.className = `message ${role}-message`;
        if (role === "assistant") {
                messageEl.innerHTML = `<div class="message-content">${markdownToHtml(content)}</div>`;
        } else {
                messageEl.innerHTML = `<div class="message-content">${content.replace(/\n/g, "<br>")}</div>`;
        }
        chatMessages.appendChild(messageEl);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
}
