<template>
  <main class="chat">
    <h3 class="chat-title">Room Chat</h3>
    <graffiti-discover
      :channels="[channel]"
      :schema="{ properties: { value: { properties: { content: { type: 'string' }, published: { type: 'number' } }, required: ['content', 'published'] }}}"
      :session="session"
      v-slot="{ objects: messages }"
      autopoll
    >
      <ul class="messages-list">
        <li
          v-for="message in messages.toSorted((a, b)=> a.value.published - b.value.published)"
          :key="message.url"
        >
          <article
            :class="{ 'is-own-message': isOwnMessage(message) }"
          >
            <header v-if="!isOwnMessage(message)">
              <h4>
                <graffiti-actor-to-handle :actor="message.actor" />
              </h4>
            </header>
            <p class="message-content">{{ message.value.content }}</p>
            <footer>
              <time :datetime="new Date(message.value.published).toISOString()">
                {{ new Date(message.value.published).toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' }) }}
              </time>
            </footer>
          </article>
        </li>
      </ul>
    </graffiti-discover>

    <!-- Always show input form -->
    <form @submit.prevent="sendMessage" class="chat-form">
      <input
        id="message"
        type="text"
        v-model="messageText"
        placeholder="Type a message..."
        :disabled="!session || sending"
        autocomplete="off"
      />
      <button type="submit" :disabled="!messageText || !session || sending">
        {{ session ? 'Send' : 'Log in to chat' }}
      </button>
    </form>
  </main>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from 'vue';

const props = defineProps({
  channel: {
    type: String,
    required: true
  }
});

const messageText = ref('');
const sending = ref(false);
const instance = getCurrentInstance();
const $graffitiSession = instance?.appContext.config.globalProperties.$graffitiSession;
const $graffiti = instance?.appContext.config.globalProperties.$graffiti;

// Computed property for session
const session = computed(() => $graffitiSession?.value);

function isOwnMessage(msg) {
  const currentSession = session.value;
  if (!currentSession || !msg) return false;

  const sessionActor = currentSession.actor;
  const msgActor = msg.actor;

  // Try direct comparison first
  if (sessionActor === msgActor) return true;

  // Handle object actors
  if (typeof sessionActor === 'object' && typeof msgActor === 'object') {
    // Compare by handle
    if (sessionActor.handle && msgActor.handle) {
      return sessionActor.handle === msgActor.handle;
    }
    // Compare by id
    if (sessionActor.id && msgActor.id) {
      return sessionActor.id === msgActor.id;
    }
  }

  // Handle mixed types (object vs string)
  if (typeof sessionActor === 'object' && typeof msgActor === 'string') {
    return sessionActor.handle === msgActor || sessionActor.id === msgActor;
  }
  if (typeof msgActor === 'object' && typeof sessionActor === 'string') {
    return msgActor.handle === sessionActor || msgActor.id === sessionActor;
  }

  return false;
}

function sendMessage() {
  const currentSession = session.value;

  // If not logged in, trigger login
  if (!currentSession) {
    if ($graffiti) {
      $graffiti.login();
    }
    return;
  }

  // If no message text, do nothing
  if (!messageText.value || sending.value) return;

  sending.value = true;

  $graffiti.post({
    channels: [props.channel],
    value: {
      content: messageText.value,
      published: Date.now(),
    },
  }, currentSession)
    .then(() => {
      messageText.value = '';
    })
    .catch(e => {
      console.error('Failed to send message:', e);
      alert('Failed to send message: ' + e.message);
    })
    .finally(() => {
      sending.value = false;
      setTimeout(() => {
        document.querySelector('#message')?.focus();
      }, 0);
    });
}
</script>

<style scoped>
.chat {
  width: 100%;
  background: #f8f8fa;
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 2rem;
  border: 1px solid #e0e0e0;
}

.chat-title {
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: #23272f;
}

.messages-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem 0;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border-radius: 8px;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.messages-list:empty::after {
  content: 'No messages yet. Start the conversation!';
  color: #888;
  text-align: center;
  display: block;
  padding: 2rem;
  font-style: italic;
}

article {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: #e3f2fd;
  max-width: 80%;
  width: fit-content;
}

article.is-own-message {
  background: #4f8cff;
  color: white;
  margin-left: auto;
  text-align: right;
}

header {
  margin-bottom: 0.25rem;
}

header h4 {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0;
  color: #555;
}

.is-own-message header h4 {
  color: rgba(255, 255, 255, 0.9);
}

.message-content {
  margin: 0;
  font-size: 0.95rem;
  word-wrap: break-word;
  word-break: break-word;
}

footer {
  margin-top: 0.25rem;
}

footer time {
  font-size: 0.75rem;
  color: #888;
}

.is-own-message footer time {
  color: rgba(255, 255, 255, 0.8);
}

.chat-form {
  display: flex;
  gap: 0.5rem;
}

.chat-form input {
  flex: 1;
  padding: 0.6rem 1rem;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: inherit;
  transition: border-color 0.2s;
  background: white;
}

.chat-form input:focus {
  outline: none;
  border-color: #4f8cff;
}

.chat-form input:disabled {
  background: #f0f0f0;
  cursor: not-allowed;
}

.chat-form button {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 8px;
  background: #4f8cff;
  color: white;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.chat-form button:hover:not(:disabled) {
  background: #2563eb;
}

.chat-form button:disabled {
  background: #bfc7d1;
  cursor: not-allowed;
}

/* Scrollbar styling for messages list */
.messages-list::-webkit-scrollbar {
  width: 6px;
}

.messages-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.messages-list::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}

.messages-list::-webkit-scrollbar-thumb:hover {
  background: #aaa;
}
</style>
