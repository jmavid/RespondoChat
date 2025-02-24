import { createParser } from 'eventsource-parser';
import { getDocumentContext } from './embeddings';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const RETRY_DELAY = 1000;
const MAX_RETRIES = 3;

export class ChatGPTClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.controller = null;
  }

  async streamChat(messages, onMessage, onError, onComplete) {
    let retries = 0;
    this.controller = new AbortController();
    
    // Get relevant document context for the last user message
    const lastUserMessage = messages.findLast(m => m.role === 'user');
    const context = lastUserMessage ? await getDocumentContext(lastUserMessage.content) : null;
    
    // If we have relevant context, add it to the messages
    const enhancedMessages = [...messages];
    if (context) {
      enhancedMessages.unshift({
        role: 'system',
        content: `Here is some relevant context from the user's documents:\n\n${context}\n\nPlease use this information to help answer the user's questions.`
      });
    }

    const makeRequest = async () => {
      try {
        const response = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: enhancedMessages,
            stream: true,
          }),
          signal: this.controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const parser = createParser((event) => {
          if (event.type === 'event') {
            if (event.data === '[DONE]') {
              onComplete();
              return;
            }
            try {
              const data = JSON.parse(event.data);
              const content = data.choices[0]?.delta?.content;
              if (content) {
                onMessage(content);
              }
            } catch (error) {
              console.error('Parse error:', error);
            }
          }
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          parser.feed(chunk);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          return;
        }
        
        if (retries < MAX_RETRIES) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
          await makeRequest();
        } else {
          onError(error);
        }
      }
    };

    await makeRequest();
  }

  cancelStream() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }
}