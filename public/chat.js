/**
 * LLM Chat App Frontend - ChatGPT Multi-Session Architecture
 * Enhanced with Hyperlink Support
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Utility Navigation Controls
const historyButton = document.getElementById("history-button");
const newChatButton = document.getElementById("new-chat-button");
const historyModal = document.getElementById("history-modal");
const closeHistory = document.getElementById("close-history");
const historyLogBody = document.getElementById("history-log-body");

// Storage Schema Keys
const SESSIONS_STORAGE_KEY = "cf_ai_chat_sessions_v1";
const CURRENT_ID_STORAGE_KEY = "cf_ai_chat_current_id_v1";

// Default system baseline greeting
const DEFAULT_WELCOME = "Hello! I'm an LLM chat app powered by Cloudflare Workers AI. How can I help you today?";

// Application Memory State Structure
let chatSessions = JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY)) || [];
let currentSessionId = localStorage.getItem(CURRENT_ID_STORAGE_KEY) || null;
let isProcessing = false;

/**
 * Returns the currently active chat session object
 */
function getCurrentSession() {
	return chatSessions.find(s => s.id === currentSessionId);
}

/**
 * Generates an entirely fresh active conversation session tracking frame
 */
function createNewSession() {
	const newId = "session_" + Date.now();
	const newSession = {
		id: newId,
		title: "New Chat Session",
		timestamp: new Date().toLocaleDateString(),
		history: [
			{ role: "assistant", content: DEFAULT_WELCOME }
		]
	};
	chatSessions.unshift(newSession);
	currentSessionId = newId;
	saveState();
	renderCurrentChat();
}

/**
 * Saves current app states into permanent local storage vectors
 */
function saveState() {
	localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(chatSessions));
	localStorage.setItem(CURRENT_ID_STORAGE_KEY, currentSessionId);
}

/**
 * Renders the active conversation message history into the main window view
 */
function renderCurrentChat() {
	const existingMsgs = chatMessages.querySelectorAll(".message");
	existingMsgs.forEach(el => el.remove());

	const session = getCurrentSession();
	if (!session) return;

	session.history.forEach(msg => {
		if (msg.role !== "system") {
			addMessageToChatUi(msg.role, msg.content);
		}
	});
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

// Action Event Wireups
sendButton.addEventListener("click", sendMessage);

// "New Chat" mimics GPT: Saves what you have, switches context cleanly
newChatButton.addEventListener("click", () => {
	const current = getCurrentSession();
	if (current && current.history.length <= 1) {
		alert("You are already in a clean new chat window.");
		return;
	}
	createNewSession();
});

// Build the Session Sidebar List View
historyButton.addEventListener("click", () => {
	historyLogBody.innerHTML = "";

	if (chatSessions.length === 0) {
		historyLogBody.innerHTML = `<p style="color: var(--text-light); text-align:center; padding:1rem;">No past chat rooms recorded.</p>`;
	} else {
		chatSessions.forEach(session => {
			const item = document.createElement("div");
			item.className = "history-session-item";
			const titleText = session.title;
			
			item.innerHTML = `
				<div class="session-title">${escapeHtml(titleText)}</div>
				<div class="session-date">${session.timestamp}</div>
			`;
			
			item.addEventListener("click", () => {
				currentSessionId = session.id;
				saveState();
				renderCurrentChat();
				historyModal.classList.remove("active");
			});

			historyLogBody.appendChild(item);
		});
	}
	historyModal.classList.add("active");
});

closeHistory.addEventListener("click", () => historyModal.classList.remove("active"));
window.addEventListener("click", (e) => { if (e.target === historyModal) historyModal.classList.remove("active"); });

/**
 * Formats text with hyperlinks - converts URLs and markdown links to clickable HTML
 */
function formatTextWithLinks(text) {
	if (!text) return '';
	
	let formattedText = text;
	
	// Convert markdown links: [text](url)
	const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
	formattedText = formattedText.replace(markdownLinkRegex, (match, linkText, url) => {
		return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="chat-link">${escapeHtml(linkText)}</a>`;
	});
	
	// Convert plain URLs (http://, https://)
	const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
	formattedText = formattedText.replace(urlRegex, (url) => {
		if (formattedText.includes(`href="${url}"`)) return url;
		const displayUrl = url.length > 50 ? url.substring(0, 47) + "..." : url;
		return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="chat-link">${escapeHtml(displayUrl)}</a>`;
	});
	
	// Convert www. URLs (without protocol)
	const wwwRegex = /(www\.[^\s<>"']+)/g;
	formattedText = formattedText.replace(wwwRegex, (url) => {
		if (formattedText.includes(`href="${url}"`)) return url;
		const fullUrl = "http://" + url;
		const displayUrl = url.length > 50 ? url.substring(0, 47) + "..." : url;
		return `<a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" class="chat-link">${escapeHtml(displayUrl)}</a>`;
	});
	
	// Convert email addresses
	const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
	formattedText = formattedText.replace(emailRegex, (email) => {
		return `<a href="mailto:${escapeHtml(email)}" class="chat-link">${escapeHtml(email)}</a>`;
	});
	
	// Preserve line breaks
	formattedText = formattedText.replace(/\n/g, '<br>');
	
	return formattedText;
}

/**
 * Adds message to chat UI with hyperlink support
 */
function addMessageToChatUi(role, content, isStreaming = false) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;
	
	if (role === "assistant") {
		messageEl.innerHTML = `<div class="message-content"></div>`;
		const contentDiv = messageEl.querySelector(".message-content");
		
		if (isStreaming) {
			contentDiv.setAttribute('data-raw-text', content);
			contentDiv.innerHTML = formatTextWithLinks(content);
		} else {
			contentDiv.innerHTML = formatTextWithLinks(content);
		}
	} else {
		const formattedContent = escapeHtml(content).replace(/\n/g, '<br>');
		messageEl.innerHTML = `<div class="message-content">${formattedContent}</div>`;
	}
	
	chatMessages.insertBefore(messageEl, typingIndicator);
	scrollToBottom();
	return messageEl;
}

/**
 * Updates streaming message content with hyperlinks
 */
function updateStreamingMessage(messageEl, content) {
	const contentDiv = messageEl.querySelector(".message-content");
	if (contentDiv) {
		contentDiv.setAttribute('data-raw-text', content);
		contentDiv.innerHTML = formatTextWithLinks(content);
		scrollToBottom();
	}
}

/**
 * Handles communication with backend and manages history states
 */
async function sendMessage() {
	const message = userInput.value.trim();
	if (message === "" || isProcessing) return;

	let session = getCurrentSession();
	if (!session) {
		createNewSession();
		session = getCurrentSession();
	}

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	addMessageToChatUi("user", message);
	session.history.push({ role: "user", content: message });

	if (session.title === "New Chat Session" || session.history.length <= 3) {
		session.title = message.length > 30 ? message.substring(0, 30) + "..." : message;
	}
	saveState();

	userInput.value = "";
	userInput.style.height = "auto";
	typingIndicator.classList.add("visible");
	scrollToBottom();

	let responseText = "";
	let assistantMessageEl = null;

	try {
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: session.history }),
		});

		if (!response.ok) throw new Error("Failed response state.");
		if (!response.body) throw new Error("Null response payload stream.");

		typingIndicator.classList.remove("visible");

		assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";
		assistantMessageEl.innerHTML = `<div class="message-content"></div>`;
		chatMessages.appendChild(assistantMessageEl);
		scrollToBottom();

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		const processEvents = (events) => {
			for (const data of events) {
				if (data === "[DONE]") return true;
				try {
					const jsonData = JSON.parse(data);
					const content = jsonData.response || jsonData.choices?.[0]?.delta?.content || "";
					if (content) {
						responseText += content;
						updateStreamingMessage(assistantMessageEl, responseText);
					}
				} catch (e) {
					console.error("SSE parse error", e);
				}
			}
			return false;
		};

		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				const parsed = consumeSseEvents(buffer + "\n\n");
				processEvents(parsed.events);
				break;
			}
			buffer += decoder.decode(value, { stream: true });
			const parsed = consumeSseEvents(buffer);
			buffer = parsed.buffer;
			if (processEvents(parsed.events)) break;
		}

		if (responseText.trim().length > 0) {
			session.history.push({ role: "assistant", content: responseText });
			saveState();
		}

	} catch (error) {
		console.error("Chat Execution Error:", error);
		typingIndicator.classList.remove("visible");
		addMessageToChatUi("assistant", "Sorry, there was an error processing your request.");
	} finally {
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

function scrollToBottom() {
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");
	const events = [];
	let eventEndIndex;
	while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
		const rawEvent = normalized.slice(0, eventEndIndex);
		normalized = normalized.slice(eventEndIndex + 2);
		const lines = rawEvent.split("\n");
		const dataLines = [];
		for (const line of lines) {
			if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
		}
		if (dataLines.length === 0) continue;
		events.push(dataLines.join("\n"));
	}
	return { events, buffer: normalized };
}

function escapeHtml(str) {
	if (!str) return '';
	return str.replace(/&/g, "&amp;")
			  .replace(/</g, "&lt;")
			  .replace(/>/g, "&gt;")
			  .replace(/"/g, "&quot;")
			  .replace(/'/g, "&#039;");
}

// App Initialization Cycle Setup
if (!currentSessionId || !getCurrentSession()) {
	if (chatSessions.length > 0) {
		currentSessionId = chatSessions[0].id;
	} else {
		createNewSession();
	}
}
saveState();
renderCurrentChat();
