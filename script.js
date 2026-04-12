/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");

/* Store all products and the user's selected product IDs */
let allProducts = [];
const selectedProductIds = new Set();

/* Keep conversation history so the chatbot remembers previous messages */
const messages = [
  {
    role: "system",
    content:
      "You are a helpful beauty and skincare advisor. Give beginner-friendly routine and product advice in clear, short steps.",
  },
];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
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
    </button>
  `,
    )
    .join("");
}

/* Return a full product object from an ID */
function getProductById(productId) {
  return allProducts.find((product) => product.id === Number(productId));
}

/* Return selected product objects */
function getSelectedProducts() {
  return Array.from(selectedProductIds)
    .map((id) => getProductById(id))
    .filter(Boolean);
}

/* Show selected products as removable chips */
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

/* Build a clean context block listing selected products for the AI */
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

/* Repaint current product grid so selected cards stay highlighted */
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

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
});

/* Click product cards to add/remove them from selected list */
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

/* Remove selected products directly from the selected list */
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

/* Add one message to the chat window */
function appendMessage(sender, text) {
  const messageElement = document.createElement("p");
  messageElement.className = "chat-message";
  messageElement.textContent = `${sender}: ${text}`;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Send all conversation messages to OpenAI and return the chatbot reply */
async function getChatbotReply() {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${open_api_key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "OpenAI request failed");
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/* Send a user message to OpenAI and print the assistant response */
async function sendMessageToAssistant(userMessage, visibleUserMessage) {
  appendMessage("You", visibleUserMessage || userMessage);

  messages.push({
    role: "user",
    content: userMessage,
  });

  appendMessage("Assistant", "Thinking...");

  try {
    const assistantReply = await getChatbotReply();

    /* Replace the temporary Thinking... line with the real response */
    chatWindow.lastChild.remove();
    appendMessage("Assistant", assistantReply);

    messages.push({
      role: "assistant",
      content: assistantReply,
    });
  } catch (error) {
    chatWindow.lastChild.remove();
    appendMessage("System", `Error: ${error.message}`);
  }
}

/* Chat form submission handler with OpenAI integration */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();
  if (!userMessage) {
    return;
  }

  if (typeof open_api_key === "undefined" || !open_api_key) {
    appendMessage("System", "Add your OpenAI key in secrets.js first.");
    return;
  }

  userInput.value = "";

  const selectedContext = buildSelectedProductsContext();
  const contextualUserMessage = `${userMessage}\n\nProduct context for this user:\n${selectedContext}`;

  await sendMessageToAssistant(contextualUserMessage, userMessage);
});

/* Generate routine directly from selected products */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProductIds.size === 0) {
    appendMessage(
      "System",
      "Please select at least one product first, then click Generate Routine.",
    );
    return;
  }

  if (typeof open_api_key === "undefined" || !open_api_key) {
    appendMessage("System", "Add your OpenAI key in secrets.js first.");
    return;
  }

  const selectedContext = buildSelectedProductsContext();
  const routineRequest = `Create a beginner-friendly AM/PM routine based ONLY on these selected products.\n\n${selectedContext}\n\nRules:\n1) Use only selected products.\n2) Put steps in the correct order.\n3) Keep it short and clear for a beginner.\n4) Mention how often to use each product.\n5) If important product types are missing (like sunscreen), clearly mention what is missing.`;

  await sendMessageToAssistant(
    routineRequest,
    "Build my routine from my selected products.",
  );
});

/* Initialize app data and selected-products area */
async function init() {
  allProducts = await loadProducts();
  renderSelectedProducts();
}

init();
