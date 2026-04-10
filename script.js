/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

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
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `,
    )
    .join("");
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
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

  appendMessage("You", userMessage);
  userInput.value = "";

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
});
