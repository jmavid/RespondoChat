const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1';

async function openaiRequest(endpoint, method = 'GET', body = null) {
  try {
    const response = await fetch(`${OPENAI_API_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v1'
      },
      body: body ? JSON.stringify(body) : null
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export async function createAssistant({ name, instructions, model }) {
  return await openaiRequest('/assistants', 'POST', {
    name,
    instructions,
    model,
    tools: [{ type: "code_interpreter" }]
  });
}

export async function createThread() {
  return await openaiRequest('/threads', 'POST');
}

export async function addMessage(threadId, content) {
  return await openaiRequest(`/threads/${threadId}/messages`, 'POST', {
    role: 'user',
    content
  });
}

export async function runAssistant(assistantId, threadId) {
  // Start the run
  const run = await openaiRequest(`/threads/${threadId}/runs`, 'POST', {
    assistant_id: assistantId
  });

  // Poll for completion
  while (true) {
    const runStatus = await openaiRequest(`/threads/${threadId}/runs/${run.id}`);
    
    if (runStatus.status === 'completed') {
      // Get messages after completion
      const messages = await openaiRequest(`/threads/${threadId}/messages`);
      // Return the assistant's last message
      const lastMessage = messages.data.find(m => m.role === 'assistant');
      return lastMessage.content[0].text.value;
    }
    
    if (runStatus.status === 'failed') {
      throw new Error('Assistant run failed');
    }
    
    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}