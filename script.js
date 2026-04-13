// DOM references
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const newChatBtn = document.getElementById("newChatBtn");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const savedItemsList = document.getElementById("savedItemsList");

// App state and shared constants
let allProducts = [];
const selectedProductIds = new Set();
const CHAT_HISTORY_STORAGE_KEY = "loreal-chat-history";
const SAVED_ITEMS_STORAGE_KEY = "loreal-saved-items";
const messageElementMap = new Map();
let savedItems = [];
let messageIdCounter = 0;
let savedItemIdCounter = 0;
const CLOUDFLARE_WORKER_URL =
  "https://loreal-chatbot-rountine-builder.liwinsto.workers.dev/";
const SYSTEM_PROMPT =
  "You are a helpful beauty and skincare advisor. Keep answers clear, direct, and beginner-friendly. Be brief for simple questions, more detailed for complex ones, and ask a clarifying question when needed. For routine requests, use this format: Title line, AM Routine, PM Routine, Why this works, and Missing step if needed. Use short numbered steps.";
const messages = [
  {
    role: "system",
    content: SYSTEM_PROMPT,
  },
];

// Initial screen state
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

// Product loading and rendering
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found for this category
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map(
      (product) => `
    <button class="product-card ${selectedProductIds.has(product.id) ? "selected" : ""}" data-product-id="${product.id}" type="button" aria-label="Select ${product.name}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
      <div class="product-description-tooltip">${product.description}</div>
    </button>
  `,
    )
    .join("");
}

// Product selection helpers
function getProductById(productId) {
  return allProducts.find((product) => product.id === Number(productId));
}

function getSelectedProducts() {
  return Array.from(selectedProductIds)
    .map((id) => getProductById(id))
    .filter(Boolean);
}

function renderSelectedProducts() {
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<p class="placeholder-message">No products selected yet</p>`;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <button class="selected-product-chip" data-remove-id="${product.id}" type="button">
        ${product.name}
        <span aria-hidden="true">&times;</span>
      </button>
    `,
    )
    .join("");
}

function buildSelectedProductsContext() {
  const selectedProducts = getSelectedProducts();

  if (selectedProducts.length === 0) {
    return "User has not selected any products yet.";
  }

  const productLines = selectedProducts.map(
    (product) =>
      `- ${product.name} (${product.brand}, ${product.category}): ${product.description}`,
  );

  return `Selected products:\n${productLines.join("\n")}`;
}

// Storage and saved routine helpers
function createUniqueId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  if (prefix === "message") {
    messageIdCounter += 1;
    return `${prefix}-${Date.now()}-${messageIdCounter}`;
  }

  savedItemIdCounter += 1;
  return `${prefix}-${Date.now()}-${savedItemIdCounter}`;
}

function isRoutineMessage(text) {
  return /AM Routine:|PM Routine:|Why this works:/i.test(text);
}

function getMessageLabel(role) {
  if (role === "user") {
    return "You";
  }

  if (role === "assistant") {
    return "Assistant";
  }

  return "System";
}

function extractRoutineTopic(routineText) {
  const firstLine =
    routineText.split("\n").find((line) => line.trim().length > 0) || "";
  const cleanedFirstLine = firstLine.replace(/^Title:\s*/i, "").trim();

  if (cleanedFirstLine.length >= 5) {
    return cleanedFirstLine.slice(0, 60);
  }

  const amLine = routineText
    .split("\n")
    .find((line) =>
      /am routine|pm routine|sensitive|acne|dry|oily|hydration/i.test(line),
    );

  if (amLine) {
    return amLine.trim().slice(0, 60);
  }

  return "My routine";
}

function persistChatHistory() {
  const conversationMessages = messages.filter(
    (message) => message.role !== "system",
  );
  localStorage.setItem(
    CHAT_HISTORY_STORAGE_KEY,
    JSON.stringify(conversationMessages),
  );
}

function persistSavedItems() {
  localStorage.setItem(SAVED_ITEMS_STORAGE_KEY, JSON.stringify(savedItems));
}

function loadChatHistory() {
  const storedHistory = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);

  if (!storedHistory) {
    return [];
  }

  try {
    const parsedHistory = JSON.parse(storedHistory);
    return Array.isArray(parsedHistory) ? parsedHistory : [];
  } catch (error) {
    return [];
  }
}

function loadSavedItems() {
  const storedItems = localStorage.getItem(SAVED_ITEMS_STORAGE_KEY);

  if (!storedItems) {
    return [];
  }

  try {
    const parsedItems = JSON.parse(storedItems);
    return Array.isArray(parsedItems) ? parsedItems : [];
  } catch (error) {
    return [];
  }
}

function renderSavedItems() {
  if (!savedItemsList) {
    return;
  }

  if (savedItems.length === 0) {
    savedItemsList.innerHTML = `
      <div class="saved-empty-state">
        <p>No saved routines yet.</p>
      </div>
    `;
    return;
  }

  savedItemsList.innerHTML = savedItems
    .map(
      (item) => `
        <article class="saved-item">
          <div class="saved-item-header">
            <div>
              <p class="saved-item-type">${item.kind}</p>
              <h3>${item.title}</h3>
            </div>
            <button type="button" class="saved-item-delete" data-delete-saved-id="${item.id}">Delete</button>
          </div>
          <p class="saved-item-content">${item.content}</p>
        </article>
      `,
    )
    .join("");
}

if (savedItemsList) {
  savedItemsList.addEventListener("click", (e) => {
    const deleteButton = e.target.closest("[data-delete-saved-id]");

    if (!deleteButton) {
      return;
    }

    const savedItemId = deleteButton.dataset.deleteSavedId;
    savedItems = savedItems.filter((item) => item.id !== savedItemId);
    persistSavedItems();
    renderSavedItems();
  });
}

function saveMessageToLibrary(messageId) {
  const message = messages.find((entry) => entry.id === messageId);

  if (
    !message ||
    message.role !== "assistant" ||
    !isRoutineMessage(message.content)
  ) {
    return;
  }

  const alreadySaved = savedItems.some(
    (item) => item.sourceMessageId === messageId,
  );

  if (alreadySaved) {
    return;
  }

  const defaultTopic = extractRoutineTopic(
    message.displayText || message.content,
  );
  const userTopic = window.prompt(
    "Add a short name/topic for this routine so you can find it later:",
    defaultTopic,
  );

  if (userTopic === null) {
    return;
  }

  const trimmedTopic = userTopic.trim();

  if (!trimmedTopic) {
    appendMessage("System", "Routine was not saved. Please add a name/topic.");
    return;
  }

  savedItems.unshift({
    id: createUniqueId("saved"),
    sourceMessageId: messageId,
    role: message.role,
    kind: "Routine",
    title: trimmedTopic,
    content: message.displayText || message.content,
    createdAt: new Date().toISOString(),
  });

  persistSavedItems();
  renderSavedItems();
}

function createMessageActions(message) {
  if (message.role !== "assistant" || !isRoutineMessage(message.content)) {
    return null;
  }

  const actionsContainer = document.createElement("div");
  actionsContainer.className = "message-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "message-action-button message-save-button";
  saveButton.dataset.action = "save-message";
  saveButton.dataset.messageId = message.id;
  saveButton.textContent = "Save routine";

  actionsContainer.appendChild(saveButton);

  return actionsContainer;
}

function hydrateConversation() {
  const storedConversation = loadChatHistory();

  storedConversation.forEach((message) => {
    if (!message.id) {
      message.id = createUniqueId("message");
    }

    messages.push(message);

    appendMessage(
      getMessageLabel(message.role),
      message.displayText || message.content,
      {
        messageId: message.id,
        canSave: true,
        canDelete: true,
        isRoutine:
          message.role === "assistant" && isRoutineMessage(message.content),
      },
    );
  });
}

// Category and product selection handlers
function refreshCurrentCategoryView() {
  const selectedCategory = categoryFilter.value;

  if (!selectedCategory) {
    return;
  }

  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
}

categoryFilter.addEventListener("change", async (e) => {
  const selectedCategory = e.target.value;

  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
});

productsContainer.addEventListener("click", (e) => {
  const card = e.target.closest(".product-card");

  if (!card) {
    return;
  }

  const productId = Number(card.dataset.productId);

  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }

  renderSelectedProducts();
  refreshCurrentCategoryView();
});

selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest("[data-remove-id]");

  if (!removeButton) {
    return;
  }

  const productId = Number(removeButton.dataset.removeId);

  selectedProductIds.delete(productId);

  renderSelectedProducts();
  refreshCurrentCategoryView();
});

// Chat message actions and rendering
chatWindow.addEventListener("click", (e) => {
  const actionButton = e.target.closest("[data-action]");

  if (!actionButton) {
    return;
  }

  const { action, messageId } = actionButton.dataset;

  if (action === "save-message") {
    saveMessageToLibrary(messageId);
  }
});

function appendMessage(sender, text, options = {}) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${sender.toLowerCase()}-message`;
  if (options.messageId) {
    messageElement.dataset.messageId = options.messageId;
    messageElementMap.set(options.messageId, messageElement);
  }

  const labelElement = document.createElement("p");
  labelElement.className = "chat-label";
  labelElement.textContent = sender;

  const textElement = document.createElement("p");
  textElement.className = "chat-text";
  textElement.textContent = text;

  messageElement.appendChild(labelElement);
  messageElement.appendChild(textElement);

  if (options.canSave && options.messageId) {
    const actionsElement = createMessageActions({
      id: options.messageId,
      role:
        sender === "You"
          ? "user"
          : sender === "Assistant"
            ? "assistant"
            : "system",
      content: text,
    });

    if (actionsElement) {
      messageElement.appendChild(actionsElement);
    }
  }

  chatWindow.appendChild(messageElement);

  chatWindow.scrollTop = chatWindow.scrollHeight;

  return messageElement;
}

// OpenAI request flow
async function getChatbotReply() {
  const endpoint = CLOUDFLARE_WORKER_URL;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "OpenAI request failed");
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function sendMessageToAssistant(userMessage, visibleUserMessage) {
  const userMessageId = createUniqueId("message");
  const visibleMessage = visibleUserMessage || userMessage;

  appendMessage("You", visibleMessage, {
    messageId: userMessageId,
    canSave: true,
    canDelete: true,
  });

  messages.push({
    id: userMessageId,
    role: "user",
    content: userMessage,
    displayText: visibleMessage,
  });
  persistChatHistory();

  const thinkingMessageElement = appendMessage("Assistant", "Thinking...");

  try {
    const assistantReply = await getChatbotReply();

    thinkingMessageElement.remove();
    const assistantMessageId = createUniqueId("message");
    appendMessage("Assistant", assistantReply, {
      messageId: assistantMessageId,
      canSave: true,
      canDelete: true,
    });

    messages.push({
      id: assistantMessageId,
      role: "assistant",
      content: assistantReply,
      displayText: assistantReply,
    });
    persistChatHistory();
  } catch (error) {
    thinkingMessageElement.remove();
    appendMessage("System", `Error: ${error.message}`);
  }
}

// Chat and routine actions
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();
  if (!userMessage) {
    return;
  }

  if (!CLOUDFLARE_WORKER_URL) {
    appendMessage(
      "System",
      "Set your CLOUDFLARE_WORKER_URL in script.js first.",
    );
    return;
  }

  userInput.value = "";

  const selectedContext = buildSelectedProductsContext();

  const contextualUserMessage = `${userMessage}\n\nProduct context for this user:\n${selectedContext}`;

  await sendMessageToAssistant(contextualUserMessage, userMessage);
});

generateRoutineButton.addEventListener("click", async () => {
  if (selectedProductIds.size === 0) {
    appendMessage(
      "System",
      "Please select at least one product first, then click Generate Routine.",
    );
    return;
  }

  if (!CLOUDFLARE_WORKER_URL) {
    appendMessage(
      "System",
      "Set your CLOUDFLARE_WORKER_URL in script.js first.",
    );
    return;
  }

  const selectedContext = buildSelectedProductsContext();

  const routineRequest = `Create a beginner-friendly AM/PM routine based ONLY on these selected products.\n\n${selectedContext}\n\nRules:\n1) Use only selected products.\n2) Put steps in the correct order.\n3) Keep it short and clear for a beginner.\n4) Mention how often to use each product.\n5) If important product types are missing (like sunscreen), clearly mention what is missing.\n6) Format exactly like this:\nTitle: Routine built from your selected products\nAM Routine:\n1. ...\n2. ...\nPM Routine:\n1. ...\n2. ...\nWhy this works:\n- ...\nMissing step (if any):\n- ...`;

  await sendMessageToAssistant(
    routineRequest,
    "Build my routine from my selected products.",
  );
});

// Reset and startup
function resetChat() {
  chatWindow.innerHTML = "";

  messages.length = 0;
  messages.push({
    role: "system",
    content: SYSTEM_PROMPT,
  });

  messageElementMap.clear();

  messageIdCounter = 0;

  localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
}

newChatBtn.addEventListener("click", () => {
  resetChat();
});

async function init() {
  allProducts = await loadProducts();
  renderSelectedProducts();
  savedItems = loadSavedItems();
  renderSavedItems();
  hydrateConversation();
}

init();
