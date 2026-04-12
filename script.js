/* ====== DOM ELEMENT REFERENCES ======
   Step 1: Connect to HTML elements so JavaScript can interact with them.
   - We store these in const variables so we can reference them later
   - document.getElementById() finds an element by its id attribute in HTML
   Example: If HTML has <select id="categoryFilter">, this grabs that select element
*/
const categoryFilter = document.getElementById("categoryFilter"); // The category dropdown
const productsContainer = document.getElementById("productsContainer"); // Where product cards will appear
const chatForm = document.getElementById("chatForm"); // The chat form (submit button + input)
const chatWindow = document.getElementById("chatWindow"); // The area showing chat messages
const userInput = document.getElementById("userInput"); // The text input field in the chat
const newChatBtn = document.getElementById("newChatBtn"); // Button to start a new chat
const selectedProductsList = document.getElementById("selectedProductsList"); // Container to show selected products
const generateRoutineButton = document.getElementById("generateRoutine"); // Button to generate routine
const savedItemsList = document.getElementById("savedItemsList"); // Where saved routines and conversations appear

/* ====== PRODUCT STORAGE ======
   - allProducts: Store ALL products from JSON so we can filter and look them up
   - selectedProductIds: Use a Set to store IDs of products user has clicked
   
   WHY a Set?
   - Sets are like arrays but ONLY store unique values (no duplicates)
   - Adding same ID twice = still only exists once
   - .has(), .add(), .delete() methods are faster than array methods
   - Perfect for: "Is this product already selected?"
   
   EXAMPLE:
   selectedProductIds = {1, 5, 12}  (user clicked 3 products)
   selectedProductIds.has(5) = true  (product 5 is selected)
   selectedProductIds.has(99) = false (product 99 is not selected)
*/
let allProducts = []; // Will hold all products from products.json
const selectedProductIds = new Set(); // Store IDs of selected products
const CHAT_HISTORY_STORAGE_KEY = "loreal-chat-history"; // Saves the conversation across page reloads
const SAVED_ITEMS_STORAGE_KEY = "loreal-saved-items"; // Saves routines
const messageElementMap = new Map(); // Keeps track of rendered chat messages so we can delete them later
let savedItems = []; // Saved routines
let messageIdCounter = 0; // Used to make unique chat message ids
let savedItemIdCounter = 0; // Used to make unique saved item ids

/* ====== CONVERSATION MEMORY + SYSTEM INSTRUCTIONS ======
   Purpose: Store conversation history and tell OpenAI how to behave
   
   STRUCTURE:
   - role: \"system\" (special message at start that guides the AI behavior)
   - content: Instructions for what the AI should do
   
   WHY we need these instructions?
   - Without them, OpenAI might give long, confusing answers
   - With them, we tell OpenAI: \"Be a beauty advisor\", \"Keep it short\", \"Use this format\"
   - These instructions stay in the messages array for the ENTIRE conversation
   
   Later:
   - Each user message will be added: role: \"user\"
   - Each AI response will be added: role: \"assistant\"
   - When we send to OpenAI, we include ALL previous messages
   - This gives the AI context from everything the user has asked before
*/
const messages = [
  {
    role: "system",
    content:
      "You are a helpful beauty and skincare advisor. Give beginner-friendly advice in short, clear steps. Always format routine answers with this exact structure: Title line, AM Routine section, PM Routine section, Why this works section, Missing step section (if needed). Use numbered steps and short lines.",
  },
];

/* ====== INITIAL UI STATE ======
   Step 3: Set the initial state of the products container.
   
   WHY? When the page first loads, no category is selected yet, so there are no products to show.
   Instead, we display a friendly message telling the user what to do.
   
   .innerHTML = allows us to insert HTML code directly into a DOM element
   Template literals (backticks) let us write multi-line HTML strings
*/
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* ====== LOAD PRODUCTS FUNCTION ======
   Purpose: Fetch product data from the products.json file
   
   WHY ASYNC/AWAIT?
   - fetch() takes TIME to download the file from the server
   - async/await pauses the code until the download is complete
   - Without it, we'd get the data BEFORE it finished downloading (error!)
   
   STEP-BY-STEP:
   1. fetch("products.json") = Request the JSON file from the server
   2. await = Wait for the response to come back
   3. response.json() = Convert the response into JavaScript data
   4. await again = Wait for the conversion to finish
   5. return data.products = Give back just the products array
   
   EXAMPLE:
   const products = await loadProducts();
   // Now products = [{ id: 1, name: "Cleanser", ... }, { id: 2, ... }, ...]
*/
async function loadProducts() {
  const response = await fetch("products.json"); // Request the JSON file
  const data = await response.json(); // Convert response to JavaScript object
  return data.products; // Return only the products array
}

/* ====== DISPLAY PRODUCTS FUNCTION ======
   Purpose: Convert product data into clickable HTML cards and show them on the page
   
   LOGIC:
   1. If no products match the category, show a helpful message
   2. Otherwise, transform each product object into a <button> card
   3. Check if each product is already selected (using selectedProductIds.has())
   4. If selected, add the "selected" class for visual highlighting
   5. Join all cards together and insert into the page
   
   WHY buttons instead of divs?
   - Buttons are semantic HTML (better for accessibility)
   - Users expect to click them
   - Easier for keyboard navigation
   
   WHY the "selected" class?
   - Let's users see which products they've already clicked
   - CSS makes it visually distinct
   
   TEMPLATE PARTS:
   - ${product.id} = ID for identifying which product was clicked
   - ${selectedProductIds.has(product.id) ? "selected" : ""} = Add CSS class if product is in the Set
   - data-product-id = Store the ID on the HTML element so we can read it on click
*/
function displayProducts(products) {
  // Handle empty result
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found for this category
      </div>
    `;
    return;
  }

  // Transform each product into a clickable card HTML
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

/* ====== HELPER: GET PRODUCT BY ID ======
   Purpose: Look up a full product object using just its ID number
   
   HOW IT WORKS:
   - .find() loops through allProducts array
   - Returns the FIRST product where product.id === productId
   - Number() = Convert ID to a number (database IDs are sometimes strings in HTML attributes)
   
   EXAMPLE:
   getProductById(5) might return:
   { id: 5, name: "CeraVe Cleanser", brand: "CeraVe", category: "cleanser", ... }
   
   WHY this function?
   - We store IDs in selectedProductIds Set
   - But we need full product details (name, description) to display them
   - This function converts "ID 5" into "full product 5"
*/
function getProductById(productId) {
  return allProducts.find((product) => product.id === Number(productId));
}

/* ====== HELPER: GET SELECTED PRODUCTS ======
   Purpose: Get the full product objects for all selected products
   
   STEP-BY-STEP:
   1. Array.from(selectedProductIds) = Convert Set of IDs into an array: [1, 5, 12]
   2. .map((id) => getProductById(id)) = Look up full product for each ID
   3. .filter(Boolean) = Remove any undefined values (safety check)
   
   RESULT:
   - Input: selectedProductIds = Set {1, 5, 12}
   - Output: [
       { id: 1, name: "Product A", ... },
       { id: 5, name: "Product B", ... },
       { id: 12, name: "Product C", ... }
     ]
   
   WHY this function?
   - selectedProductIds only stores IDs (lightweight)
   - But displaying and sending to OpenAI needs full product details
   - This converts "IDs" into "full product objects"
*/
function getSelectedProducts() {
  return Array.from(selectedProductIds) // Convert Set to array
    .map((id) => getProductById(id)) // Get full product for each ID
    .filter(Boolean); // Remove any undefined values
}

/* ====== RENDER SELECTED PRODUCTS ======
   Purpose: Display all selected products as removable "chips" (small tag-like buttons)
   
   LOGIC:
   1. Get full product objects for all selected items
   2. If none selected, show a placeholder message
   3. Otherwise, create a removable chip for each selected product
   4. Each chip is a button with the product name + an X icon
   5. data-remove-id stores the product ID so clicking the chip knows what to remove
   
   WHY chips?
   - Visual feedback: users see exactly which products they picked
   - Each chip has an X, so users can easily deselect by clicking
   - Compact display saves space
   
   ARIA-HIDDEN:
   - aria-hidden="true" tells screen readers to ignore the × symbol
   - Screen readers will just say "Remove Product Name" without saying "times symbol"
   - Better accessibility
*/
function renderSelectedProducts() {
  const selectedProducts = getSelectedProducts(); // Get all selected product details

  // Show placeholder if nothing selected
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<p class="placeholder-message">No products selected yet</p>`;
    return;
  }

  // Create a removable chip for each selected product
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

/* ====== BUILD SELECTED PRODUCTS CONTEXT FOR AI ======
   Purpose: Create a readable text summary of selected products to send to OpenAI
   
   WHY?
   - When user asks "build my routine", OpenAI needs to know which products were selected
   - Instead of sending raw JSON (ugly), we format it nicely as text
   - This context gets added to the user's message before sending to OpenAI
   
   EXAMPLE OUTPUT:
   "Selected products:
   - CeraVe Cleanser (CeraVe, cleanser): Gentle gel cleanser with ceramides...
   - Vichy Moisturizer (Vichy, moisturizer): Rich hydration cream for dry skin..."
   
   WHY include description?
   - OpenAI needs to understand what each product does
   - Just the name ("Cleanser") isn't enough information
   - Full description helps OpenAI build better advice
*/
function buildSelectedProductsContext() {
  const selectedProducts = getSelectedProducts();

  // If no products selected, tell OpenAI
  if (selectedProducts.length === 0) {
    return "User has not selected any products yet.";
  }

  // Format each product as a nice text line
  const productLines = selectedProducts.map(
    (product) =>
      `- ${product.name} (${product.brand}, ${product.category}): ${product.description}`,
  );

  // Join all lines together with newlines
  return `Selected products:\n${productLines.join("\n")}`;
}

/* ====== STORAGE + MESSAGE HELPERS ======
   Purpose: Keep chat history and saved items in localStorage

   WHY THIS MATTERS:
   - Users can refresh the page without losing their conversation
  - Saved routines stay available until deleted
*/
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
  const firstLine = routineText.split("\n").find((line) => line.trim().length > 0) || "";
  const cleanedFirstLine = firstLine.replace(/^Title:\s*/i, "").trim();

  if (cleanedFirstLine.length >= 5) {
    return cleanedFirstLine.slice(0, 60);
  }

  const amLine = routineText
    .split("\n")
    .find((line) => /am routine|pm routine|sensitive|acne|dry|oily|hydration/i.test(line));

  if (amLine) {
    return amLine.trim().slice(0, 60);
  }

  return "My routine";
}

function persistChatHistory() {
  const conversationMessages = messages.filter((message) => message.role !== "system");
  localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(conversationMessages));
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

  if (!message || message.role !== "assistant" || !isRoutineMessage(message.content)) {
    return;
  }

  const alreadySaved = savedItems.some((item) => item.sourceMessageId === messageId);

  if (alreadySaved) {
    return;
  }

  const defaultTopic = extractRoutineTopic(message.displayText || message.content);
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

    appendMessage(getMessageLabel(message.role), message.displayText || message.content, {
      messageId: message.id,
      canSave: true,
      canDelete: true,
      isRoutine: message.role === "assistant" && isRoutineMessage(message.content),
    });
  });
}

/* ====== REFRESH CURRENT CATEGORY VIEW ======
   Purpose: Redraw the product grid for the currently selected category
   
   WHY?
   - When user clicks a product to select/deselect it, we need to update the visual
   - The card should show "selected" highlighting or remove it
   - But we want to redraw ONLY the current category, not all products
   - This function re-filters and re-displays using current category
   
   LOGIC:
   1. Get the currently selected category from the dropdown
   2. If no category selected, do nothing (nothing to display)
   3. Filter allProducts to show only matching category
   4. Call displayProducts to refresh the grid
   5. Cards now show correct "selected" highlighting based on selectedProductIds
   
   EXAMPLE FLOW:
   - User sees "Cleansers" category (3 products show)
   - User clicks "CeraVe Cleanser" to select it
   - This function redraws those 3 cards
   - CeraVe Cleanser card now has "selected" class and highlights
*/
function refreshCurrentCategoryView() {
  const selectedCategory = categoryFilter.value; // What category is dropdown showing?

  // If no category selected, nothing to refresh
  if (!selectedCategory) {
    return;
  }

  // Get products for current category
  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory,
  );

  // Redraw the grid (now showing selected/unselected highlighting)
  displayProducts(filteredProducts);
}

/* ====== CATEGORY FILTER EVENT LISTENER ======
   Purpose: When user picks a category from dropdown, show only that category's products
   
   EVENT: "change" fires when dropdown value changes
   
   LOGIC:
   1. Get the category value user selected
   2. Filter allProducts to keep only matching category
   3. Display the filtered products as cards
   4. Users can then click cards to select/deselect
   
   FILTER() EXPLANATION:
   - filter() tests each product with a condition
   - Condition: "Does this product's category match selection?"
   - If true: product stays in array
   - If false: product removed from array
   
   EXAMPLE:
   - allProducts = [Cleanser, Moisturizer, Mascara, Shampoo, Another Cleanser]
   - User selects "cleanser" category
   - filter() checks each product
   - Returns: [Cleanser, Another Cleanser]
   - displayProducts renders only these 2 cards
*/
categoryFilter.addEventListener("change", async (e) => {
  const selectedCategory = e.target.value; // What category did user pick?

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts); // Show the filtered products
});

/* ====== PRODUCT CARD CLICK HANDLER ======
   Purpose: When user clicks a product card, toggle it selected/unselected
   
   EVENT DELEGATION:
   - We listen on the CONTAINER (productsContainer)
   - But we only act if a PRODUCT CARD was clicked
   - WHY? More efficient than attaching click handler to each card
   - User can still see click even if card is generated dynamically
   
   EVENT TARGET CLOSEST:
   - e.target = Whatever element user actually clicked (could be img, h3, p, etc.)
   - .closest(".product-card") = Find the nearest ancestor with class "product-card"
   - Returns null if no ancestor found (user didn't click on a card)
   
   TOGGLE SELECTION LOGIC:
   - If product ID is already in selectedProductIds: REMOVE it (deselect)
   - If product ID is NOT in selectedProductIds: ADD it (select)
   - This is toggle behavior: click selects, click again deselects
   
   THEN:
   1. Redraw selected products chips so user sees their selections
   2. Refresh the category grid so cards show correct highlighting
   
   EXAMPLE FLOW:
   Click: Product 5 not selected → Add 5 to Set → Update UI
   Click: Product 5 is selected → Remove 5 from Set → Update UI
*/
productsContainer.addEventListener("click", (e) => {
  // Find the product card that was clicked (could be nested inside)
  const card = e.target.closest(".product-card");

  // If click wasn't on a card, do nothing
  if (!card) {
    return;
  }

  // Get the product ID from the HTML attribute
  const productId = Number(card.dataset.productId);

  // Toggle: remove if already selected, add if not selected
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId); // Deselect
  } else {
    selectedProductIds.add(productId); // Select
  }

  // Update UI to show the change
  renderSelectedProducts(); // Update the chips area
  refreshCurrentCategoryView(); // Highlight the card in grid
});

/* ====== REMOVE SELECTED PRODUCT HANDLER ======
   Purpose: When user clicks the X on a selected product chip, deselect it
   
   HOW IT WORKS:
   - User sees product chips (e.g., "CeraVe Cleanser [×]")
   - Clicking the X calls this handler
   - We find which product to remove using data-remove-id
   - Remove it from selectedProductIds
   - Update UI to reflect the change
   
   EVENT DELEGATION:
   - Listen on selectedProductsList (the container)
   - Only react if user clicked something with [data-remove-id]
   - Why? Cards are generated dynamically, this handles them all
   
   EXAMPLE:
   User has: [CeraVe Cleanser, Vichy Serum]
   User clicks X on CeraVe Cleanser
   → data-remove-id = 1
   → Remove product 1 from selectedProductIds
   → Refresh UI
   → Now shows: [Vichy Serum]
*/
selectedProductsList.addEventListener("click", (e) => {
  // Find the button with data-remove-id (the X button on a chip)
  const removeButton = e.target.closest("[data-remove-id]");

  // If click wasn't on a remove button, do nothing
  if (!removeButton) {
    return;
  }

  // Get the product ID to remove
  const productId = Number(removeButton.dataset.removeId);
  
  // Deselect the product
  selectedProductIds.delete(productId);
  
  // Update UI to reflect the removal
  renderSelectedProducts(); // Remove the chip
  refreshCurrentCategoryView(); // Update highlighting in product grid
});

/* ====== CHAT ACTION HANDLER ======
   Purpose: Let users save or delete individual chat messages
*/
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

/* ====== APPEND MESSAGE FUNCTION ======
   Purpose: Add a new message to the chat window
   
   WHY CREATE rather than use innerHTML?
   - .innerHTML can be risky (security concern with untrusted text)
   - createElement is safer for adding individual messages
   - We can also RETURN the element for later removal (for "Thinking..." placeholder)
   
   STRUCTURE:
   - Create a container <div> for the entire message
   - Add CSS classes like "you-message" or "assistant-message" for styling
   - Create a <p> for the sender label ("You", "Assistant", etc.)
   - Create a <p> for the actual message text
   - Append both to the container
   - Append container to chatWindow
   
   RETURN VALUE:
   - Return the messageElement so we can remove it later
   - Example: when "Thinking..." is replaced with actual reply, we call .remove() on it
   
   AUTO-SCROLL:
   - chatWindow.scrollTop = chatWindow.scrollHeight
   - Auto-scrolls to bottom so user always sees newest message
   - Like real chat apps: Messages appear at bottom, older messages scroll up
   
   EXAMPLE CALL:
   const thinkingMsg = appendMessage("Assistant", "Thinking...");
   // Later: thinkingMsg.remove(); // Remove it and replace with real reply
*/
function appendMessage(sender, text, options = {}) {
  // Create main container for the message
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${sender.toLowerCase()}-message`; // CSS class based on sender
  if (options.messageId) {
    messageElement.dataset.messageId = options.messageId;
    messageElementMap.set(options.messageId, messageElement);
  }

  // Create label showing who sent it ("You", "Assistant", etc.)
  const labelElement = document.createElement("p");
  labelElement.className = "chat-label";
  labelElement.textContent = sender;

  // Create the actual message text
  const textElement = document.createElement("p");
  textElement.className = "chat-text";
  textElement.textContent = text;

  // Add label and text to the container
  messageElement.appendChild(labelElement);
  messageElement.appendChild(textElement);

  if (options.canSave && options.messageId) {
    const actionsElement = createMessageActions({
      id: options.messageId,
      role: sender === "You" ? "user" : sender === "Assistant" ? "assistant" : "system",
      content: text,
    });

    if (actionsElement) {
      messageElement.appendChild(actionsElement);
    }
  }
  
  // Add the complete message to the chat window
  chatWindow.appendChild(messageElement);
  
  // Auto-scroll to show new message
  chatWindow.scrollTop = chatWindow.scrollHeight;

  // Return the element so it can be removed later if needed
  return messageElement;
}

/* ====== GET CHATBOT REPLY FUNCTION ======
   Purpose: Send the conversation history to OpenAI and get the AI's response
   
   HOW OPENAI API WORKS:
   1. We make a POST request (sending data to the server, not just getting it)
   2. We send the entire messages array (so OpenAI has context)
   3. OpenAI processes it and returns a response
   4. We extract just the text from the response
   
   FETCH REQUEST BREAKDOWN:
   - URL: OpenAI's chat API endpoint
   - method: "POST" = sending data (vs GET which just retrieves)
   - headers: Tell OpenAI who we are (API key) and data format (JSON)
   - body: The actual data we're sending (model + messages)
   - JSON.stringify() = Convert JavaScript object to JSON text
   
   ERROR HANDLING:
   - if (!response.ok) = Check if the request succeeded
   - If failed, throw an Error so we can catch it later
   
   RESPONSE STRUCTURE:
   - OpenAI returns: { choices: [{ message: { content: "The AI's reply" }}] }
   - data.choices[0].message.content = Extract just the text reply
   
   WHY this function?
   - Keeps API logic separate from the chat handler
   - Makes code easier to test and reuse
*/
async function getChatbotReply() {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", // POST = we're sending data, not just retrieving
    headers: {
      "Content-Type": "application/json", // Tell OpenAI we're sending JSON
      Authorization: `Bearer ${open_api_key}`, // Authentication: include API key
    },
    body: JSON.stringify({
      model: "gpt-4o", // Which AI model to use
      messages: messages.map(({ role, content }) => ({ role, content })), // Send the entire conversation history
    }),
  });

  // Check if the API request was successful
  if (!response.ok) {
    const errorData = await response.json(); // Get error details from OpenAI
    throw new Error(errorData.error?.message || "OpenAI request failed");
  }

  const data = await response.json(); // Convert response to JavaScript object
  return data.choices[0].message.content; // Extract and return just the reply text
}

/* ====== SEND MESSAGE TO ASSISTANT ======
   Purpose: Core function that handles the entire chat flow
   
   TWO MESSAGE PARAMETERS:
   - userMessage: What's sent to OpenAI (may include product context)
   - visibleUserMessage: What's shown to user in chat (usually just their question)
   
   WHY TWO?
   - User types: "Build my routine"
   - Visible message shown: "Build my routine"
   - Hidden message sent to OpenAI: "Build my routine\n\nProduct context: ..." 
   - This keeps the chat clean while giving OpenAI the product info
   
   FLOW:
   1. Show user what they typed
   2. Add to messages array for context
   3. Show temporary "Thinking..." message
   4. Call getChatbotReply() to get AI response
   5. Replace "Thinking..." with actual reply
   6. Add reply to messages array
   
   ERROR HANDLING:
   - If getChatbotReply() fails, catch shows error
   - Still removes "Thinking..." so chat doesn't get stuck
   
   WHY this function?
   - Used by both the regular chat form AND the "Generate Routine" button
   - Both need the same message flow logic
   - DRY principle: code once, use twice
*/
async function sendMessageToAssistant(userMessage, visibleUserMessage) {
  const userMessageId = createUniqueId("message");
  const visibleMessage = visibleUserMessage || userMessage;

  // Show what the user typed (or a shortened version)
  appendMessage("You", visibleMessage, {
    messageId: userMessageId,
    canSave: true,
    canDelete: true,
  });

  // Add the full message to conversation history
  messages.push({
    id: userMessageId,
    role: "user",
    content: userMessage,
    displayText: visibleMessage,
  });
  persistChatHistory();

  // Show temporary "thinking" message while waiting for OpenAI
  const thinkingMessageElement = appendMessage("Assistant", "Thinking...");

  try {
    // Wait for OpenAI to generate a response
    const assistantReply = await getChatbotReply();

    // Remove the temporary "Thinking..." and show the real reply
    thinkingMessageElement.remove();
    const assistantMessageId = createUniqueId("message");
    appendMessage("Assistant", assistantReply, {
      messageId: assistantMessageId,
      canSave: true,
      canDelete: true,
    });

    // Add OpenAI's response to conversation history
    messages.push({
      id: assistantMessageId,
      role: "assistant",
      content: assistantReply,
      displayText: assistantReply,
    });
    persistChatHistory();
  } catch (error) {
    // If something went wrong, remove "Thinking..." and show error
    thinkingMessageElement.remove();
    appendMessage("System", `Error: ${error.message}`);
  }
}

/* ====== CHAT FORM SUBMIT HANDLER ======
   Purpose: Handle when user sends a message via the chat input
   
   EVENT: "submit" fires when form is submitted
   
   VALIDATION STEPS:
   1. e.preventDefault() = Prevent page reload (default form behavior)
   2. Get user's text and trim extra spaces
   3. Ignore empty messages
   4. Check if OpenAI API key is configured
   5. Clear input field for next message
   
   PRODUCT CONTEXT:
   - Get summary of selected products
   - Attach to userMessage as hidden context
   - User sees: "What moisturizer for dry skin?"
   - OpenAI receives: "What moisturizer for dry skin?\n\nProduct context: [list]"
   - This helps OpenAI give advice based on their selections
   
   CALL:
   - Use sendMessageToAssistant() with both versions of the message
   - await = Wait for complete chat flow before continuing
*/
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault(); // Don't reload page on form submit

  // Get user's message
  const userMessage = userInput.value.trim();
  if (!userMessage) { // Don't send empty messages
    return;
  }

  // Check if API key is configured
  if (typeof open_api_key === "undefined" || !open_api_key) {
    appendMessage("System", "Add your OpenAI key in secrets.js first.");
    return;
  }

  // Clear input for next message
  userInput.value = "";

  // Build the context about selected products
  const selectedContext = buildSelectedProductsContext();
  
  // Create message with hidden context: user sees the question, OpenAI gets product list
  const contextualUserMessage = `${userMessage}\n\nProduct context for this user:\n${selectedContext}`;

  // Send to OpenAI (with both visible and full versions)
  await sendMessageToAssistant(contextualUserMessage, userMessage);
});

/* ====== GENERATE ROUTINE BUTTON CLICK HANDLER ======
   Purpose: When user clicks "Generate Routine", create an AI routine from selected products
   
   VALIDATION:
   1. Check if user selected any products (selectedProductIds.size > 0)
   2. Check if API key is configured
   3. If either fails, show error and stop
   
   HOW IT WORKS:
   1. Get product context (names, descriptions, etc.)
   2. Create a detailed prompt for OpenAI
   3. Call sendMessageToAssistant with:
      - routineRequest: Full prompt with detailed rules for OpenAI (hidden)
      - "Build my routine...": What user sees in chat (visible)
   
   WHY DETAILED PROMPT?
   - Tells OpenAI to use ONLY selected products
   - Specifies exact format (AM Routine, PM Routine, Why this works, Missing steps)
   - Helps OpenAI understand it's creating for a BEGINNER
   - Prevents confusing or overly complex answers
   
   EXAMPLE PROMPT STRUCTURE:
   "Create a beginner routine with these products: [list]
   - Use only these products
   - Format as: Title, AM Routine, PM Routine, Why this works, Missing steps
   - Keep it simple"
   
   RESULT:
   - OpenAI sees detailed instruction + product list
   - Creates structured routine
   - Shows in chat with professional format
*/
generateRoutineButton.addEventListener("click", async () => {
  // Validation: Make sure user selected at least one product
  if (selectedProductIds.size === 0) {
    appendMessage(
      "System",
      "Please select at least one product first, then click Generate Routine.",
    );
    return;
  }

  // Validation: Make sure API key is configured
  if (typeof open_api_key === "undefined" || !open_api_key) {
    appendMessage("System", "Add your OpenAI key in secrets.js first.");
    return;
  }

  // Build context about selected products
  const selectedContext = buildSelectedProductsContext();
  
  // Create detailed prompt for OpenAI (tells it exactly how to format the routine)
  const routineRequest = `Create a beginner-friendly AM/PM routine based ONLY on these selected products.\n\n${selectedContext}\n\nRules:\n1) Use only selected products.\n2) Put steps in the correct order.\n3) Keep it short and clear for a beginner.\n4) Mention how often to use each product.\n5) If important product types are missing (like sunscreen), clearly mention what is missing.\n6) Format exactly like this:\nTitle: Routine built from your selected products\nAM Routine:\n1. ...\n2. ...\nPM Routine:\n1. ...\n2. ...\nWhy this works:\n- ...\nMissing step (if any):\n- ...`;

  // Send to OpenAI (hidden prompt + visible text)
  await sendMessageToAssistant(
    routineRequest,
    "Build my routine from my selected products.",
  );
});

/* ====== RESET CHAT FUNCTION ======
   Purpose: Clear the chat window and start a fresh conversation
   
   WHAT IT DOES:
   1. Clears all messages from the chat window (HTML)
   2. Resets the messages array to just the system message
   3. Clears the message element map used for tracking
   4. Resets the message ID counter
   5. Clears saved chat history from localStorage
   
   WHY?
   - Allows users to start a new conversation without reloading the page
   - Each new chat is independent with its own history
   - System message is preserved so AI knows how to behave
*/
function resetChat() {
  // Clear all messages from the chat window
  chatWindow.innerHTML = "";
  
  // Reset messages array to just the system message
  messages.length = 0;
  messages.push({
    role: "system",
    content:
      "You are a helpful beauty and skincare advisor. Give beginner-friendly advice in short, clear steps. Always format routine answers with this exact structure: Title line, AM Routine section, PM Routine section, Why this works section, Missing step section (if needed). Use numbered steps and short lines.",
  });
  
  // Clear the message element map
  messageElementMap.clear();
  
  // Reset message ID counter
  messageIdCounter = 0;
  
  // Clear chat history from localStorage
  localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
}

/* ====== NEW CHAT BUTTON HANDLER ======
   Purpose: Handle the "New Chat" button click
*/
newChatBtn.addEventListener("click", () => {
  resetChat();
});

/* ====== INITIALIZATION ======
   Purpose: Load all products when page first loads
   
   WHY SEPARATE INIT FUNCTION?
   - Needs to run AFTER all the functions are defined
   - Loads data before user can interact with the app
   - Keeps setup code organized in one place
   
   WHAT IT DOES:
   1. Loads all products from products.json into allProducts array
   2. Renders the empty selected products area (shows \"No products selected yet\")
   3. Now user can select a category and start picking products
   
   WHY ASYNC?
   - loadProducts() uses await, so it needs to be async
   - The (async) () => pattern is an IIFE (Immediately Invoked Function Expression)
   - Runs automatically when this code is parsed
   - Can use await inside since it's marked as async
*/
async function init() {
  allProducts = await loadProducts(); // Load all products from JSON
  renderSelectedProducts(); // Show empty selected products area
  savedItems = loadSavedItems();
  renderSavedItems();
  hydrateConversation();
}

// Run initialization when page loads
init();
