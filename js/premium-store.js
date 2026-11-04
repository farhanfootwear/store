const priceFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const elements = {
  catalog: document.querySelector("#catalog"),
  grid: document.querySelector("#product-grid"),
  searchForm: document.querySelector("#search-form"),
  search: document.querySelector("#product-search"),
  clearSearch: document.querySelector("#clear-search"),
  sort: document.querySelector("#sort-products"),
  count: document.querySelector("#result-count"),
  loading: document.querySelector("#loading-state"),
  error: document.querySelector("#error-state"),
  errorMessage: document.querySelector("#error-message"),
  retry: document.querySelector("#retry-load"),
  empty: document.querySelector("#empty-state"),
  warning: document.querySelector("#data-warning"),
  menuToggle: document.querySelector(".menu-toggle"),
  navigation: document.querySelector("#primary-navigation"),
  dialog: document.querySelector("#gallery-dialog"),
  galleryTitle: document.querySelector("#gallery-title"),
  galleryImage: document.querySelector("#gallery-image"),
  galleryCount: document.querySelector("#gallery-count"),
  previousImage: document.querySelector("#previous-image"),
  nextImage: document.querySelector("#next-image"),
  closeGallery: document.querySelector("#close-gallery"),
  createOrder: document.querySelector("#create-order"),
  orderDialog: document.querySelector("#order-dialog"),
  closeOrder: document.querySelector("#close-order"),
  orderForm: document.querySelector("#order-form"),
  orderResult: document.querySelector("#order-result"),
  orderProduct: document.querySelector("#order-product"),
  orderStatus: document.querySelector("#order-status"),
  orderMessage: document.querySelector("#whatsapp-message"),
  copyMessage: document.querySelector("#copy-message"),
  openWhatsApp: document.querySelector("#open-whatsapp"),
  editOrder: document.querySelector("#edit-order"),
  storeAddressRow: document.querySelector("#store-address-row"),
  storeAddress: document.querySelector("#store-address"),
  storePhoneRow: document.querySelector("#store-phone-row"),
  storePhone: document.querySelector("#store-phone"),
  socialLink: document.querySelector("#social-link"),
  forYouGrid: document.querySelector("#for-you-grid"),
  refreshForYou: document.querySelector("#refresh-for-you"),
  heroImage: document.querySelector("#hero-image"),
  heroProductDetails: document.querySelector("#hero-product-details"),
  heroProductName: document.querySelector("#hero-product-name"),
  heroProductPrice: document.querySelector("#hero-product-price"),
  heroProductView: document.querySelector("#hero-product-view"),
};

let products = [];
let storeName = "Farhan Footwear";
let storeContact = "";
let activeGalleryProduct = null;
let activeOrderProduct = null;
let activeImageIndex = 0;
let previousSearchWasEmpty = true;
let featuredSelection = [];

function validateCatalog(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Catalog data is missing or invalid.");
  }

  if (
    !data.store ||
    typeof data.store.name !== "string" ||
    !data.store.name.trim()
  ) {
    throw new Error("Add a non-empty store.name value to main.json.");
  }

  if (!Array.isArray(data.products)) {
    throw new Error("The catalog must include a products array.");
  }

  const validProducts = [];
  const issues = [];
  const seenIds = new Set();

  data.products.forEach((product, index) => {
    const record = index + 1;
    const fail = (message) => issues.push(`Product ${record}: ${message}`);

    if (!product || typeof product !== "object" || Array.isArray(product)) {
      fail("expected an object; this record was skipped.");
      return;
    }

    if (!Number.isSafeInteger(product.id) || product.id < 0) {
      fail("id must be a non-negative integer; this record was skipped.");
      return;
    }

    if (seenIds.has(product.id)) {
      fail(`id "${product.id}" is duplicated; this record was skipped.`);
      return;
    }
    seenIds.add(product.id);

    if (typeof product.name !== "string" || !product.name.trim()) {
      fail("name must be a non-empty string; this record was skipped.");
      return;
    }

    if (
      typeof product.price !== "number" ||
      !Number.isFinite(product.price) ||
      product.price <= 0
    ) {
      fail("price must be a positive number; this record was skipped.");
      return;
    }

    if (
      !Array.isArray(product["image-id"]) ||
      product["image-id"].length === 0 ||
      product["image-id"].some(
        (imageId) =>
          typeof imageId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(imageId),
      )
    ) {
      fail(
        "image-id must be a non-empty array of valid image IDs; this record was skipped.",
      );
      return;
    }

    validProducts.push({
      id: product.id,
      name: product.name.trim(),
      price: product.price,
      imageIds: [...product["image-id"]],
    });
  });

  if (data.products.length > 0 && validProducts.length === 0) {
    throw new Error(
      `No valid products were found. ${issues[0] || "Check product data in main.json."}`,
    );
  }

  return { storeName: data.store.name.trim(), products: validProducts, issues };
}

function resolveImagePath(imageId) {
  return `images/${encodeURIComponent(imageId)}.jpg`;
}

function createProductImage(imageId, productName, { eager = false } = {}) {
  const frame = document.createElement("span");
  frame.className = "product-image-frame";

  const img = document.createElement("img");
  img.src = resolveImagePath(imageId);
  img.alt = `${productName}, product image`;
  img.loading = eager ? "eager" : "lazy";
  img.decoding = "async";
  img.width = 800;
  img.height = 600;

  const placeholder = document.createElement("span");
  placeholder.className = "image-placeholder";
  placeholder.hidden = true;
  placeholder.setAttribute("role", "img");
  placeholder.setAttribute(
    "aria-label",
    `Product image unavailable for ${productName}`,
  );

  const title = document.createElement("strong");
  title.textContent = productName;
  const message = document.createElement("span");
  message.textContent = "Product photo unavailable";
  placeholder.append(title, message);

  img.addEventListener(
    "error",
    () => {
      img.hidden = true;
      placeholder.hidden = false;
    },
    { once: true },
  );

  frame.append(img, placeholder);
  return frame;
}

function getVisibleProducts(allProducts, searchTerm, sortOrder) {
  const query = searchTerm.trim().toLowerCase();
  const visible = allProducts.filter((product) =>
    product.name.toLowerCase().includes(query),
  );

  visible.sort((first, second) => {
    const comparison = first.name.localeCompare(second.name, undefined, {
      sensitivity: "base",
    });
    return sortOrder === "name-desc" ? -comparison : comparison;
  });

  return visible;
}

function renderProducts(list, grid, onOpenGallery) {
  const fragment = document.createDocumentFragment();

  list.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.style.animationDelay = `${Math.min(index * 40, 180)}ms`;

    const imageButton = document.createElement("button");
    imageButton.type = "button";
    imageButton.className = "product-image-button";
    imageButton.setAttribute("aria-label", `View product: ${product.name}`);
    imageButton.append(createProductImage(product.imageIds[0], product.name));
    imageButton.addEventListener("click", () => onOpenGallery(product));

    const meta = document.createElement("div");
    meta.className = "product-meta";

    const count = document.createElement("span");
    count.className = "product-image-count";
    count.textContent =
      product.imageIds.length > 1
        ? `${product.imageIds.length} images`
        : "View image";

    meta.append(count);

    const name = document.createElement("h3");
    name.className = "product-name";
    name.textContent = product.name;

    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = priceFormatter.format(product.price);

    card.append(imageButton, meta, name, price);
    fragment.append(card);
  });

  grid.replaceChildren(fragment);
}

function renderCatalog() {
  const visible = getVisibleProducts(
    products,
    elements.search.value,
    elements.sort.value,
  );
  renderProducts(visible, elements.grid, openGallery);

  elements.count.textContent = `${visible.length} ${visible.length === 1 ? "item" : "items"}`;
  elements.clearSearch.hidden = elements.search.value.length === 0;
  elements.empty.hidden = visible.length > 0 || products.length === 0;

  if (products.length === 0) {
    elements.empty.textContent =
      "The collection is being prepared. Please check back soon.";
  } else if (visible.length === 0) {
    elements.empty.textContent =
      "No shoes match your search. Try another name.";
  }
}

function scrollToCatalog() {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  elements.catalog.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });
}

function renderStoreDetails(store) {
  const address = typeof store.address === "string" ? store.address.trim() : "";
  const phone = typeof store.contact === "string" ? store.contact.trim() : "";
  const instaId =
    typeof store["insta-id"] === "string" ? store["insta-id"].trim() : "";

  elements.storeAddress.textContent = address;
  elements.storeAddressRow.hidden = !address;

  const phoneHref = phone.replace(/[^\d+]/g, "");
  if (phone && /\d/.test(phoneHref)) {
    elements.storePhone.textContent = phone;
    elements.storePhone.href = `tel:${phoneHref}`;
    elements.storePhoneRow.hidden = false;
  } else {
    elements.storePhoneRow.hidden = true;
  }

  if (instaId) {
    const cleanHandle = instaId.replace(/^@/, "");
    const socialUrl = `https://instagram.com/${cleanHandle}`;
    elements.socialLink.href = socialUrl;
    elements.socialLink.textContent = `@${cleanHandle}`;
  }
}

function shuffleProducts(items) {
  const values = [...items];

  for (let index = values.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }

  return values;
}

function selectForYouProducts() {
  featuredSelection = shuffleProducts(products).slice(0, 5);
}

function renderHeroProduct() {
  const heroProduct = products.find((product) => product.id === 0);
  if (!heroProduct) {
    elements.heroProductDetails.hidden = true;
    return;
  }

  elements.heroImage.src = `./${resolveImagePath(heroProduct.imageIds[0])}`;
  elements.heroImage.alt = `${heroProduct.name}, featured product`;
  elements.heroProductDetails.hidden = false;
  elements.heroProductName.textContent = heroProduct.name;
  elements.heroProductPrice.textContent = priceFormatter.format(
    heroProduct.price,
  );
  elements.heroImage.closest(".hero-shot").onclick = () =>
    openOrderRequest(heroProduct);
  elements.heroImage
    .closest(".hero-shot")
    .setAttribute(
      "aria-label",
      `Create an order request for ${heroProduct.name}`,
    );
  elements.heroProductView.onclick = () => openOrderRequest(heroProduct);
}

function renderForYou() {
  if (!elements.forYouGrid) return;

  if (!featuredSelection.length) {
    elements.forYouGrid.replaceChildren();
    return;
  }

  const fragment = document.createDocumentFragment();

  featuredSelection.forEach((product) => {
    const card = document.createElement("article");
    card.className = "for-you-card";

    const media = document.createElement("button");
    media.type = "button";
    media.className = "for-you-image";
    media.setAttribute("aria-label", `Open gallery for ${product.name}`);
    media.append(createProductImage(product.imageIds[0], product.name));
    media.addEventListener("click", () => openGallery(product));

    const info = document.createElement("div");
    info.className = "for-you-meta";

    const title = document.createElement("h3");
    title.textContent = product.name;

    const price = document.createElement("p");
    price.textContent = priceFormatter.format(product.price);

    const action = document.createElement("button");
    action.type = "button";
    action.className = "mini-button";
    action.textContent = "Quick view";
    action.addEventListener("click", () => openGallery(product));

    info.append(title, price, action);
    card.append(media, info);
    fragment.append(card);
  });

  elements.forYouGrid.replaceChildren(fragment);
}

function openGallery(product) {
  activeGalleryProduct = product;
  activeImageIndex = 0;
  elements.galleryTitle.textContent = product.name;
  updateGalleryImage();
  if (!elements.dialog.open) {
    elements.dialog.showModal();
  }
}

function updateGalleryImage() {
  if (!activeGalleryProduct) return;
  const { imageIds, name } = activeGalleryProduct;
  elements.galleryImage.replaceChildren(
    createProductImage(imageIds[activeImageIndex], name, { eager: true }),
  );
  elements.galleryCount.textContent = `Image ${activeImageIndex + 1} of ${imageIds.length}`;

  const hasMultiple = imageIds.length > 1;
  elements.previousImage.hidden = !hasMultiple;
  elements.nextImage.hidden = !hasMultiple;
}

function moveGalleryImage(direction) {
  if (!activeGalleryProduct || activeGalleryProduct.imageIds.length < 2) return;

  const count = activeGalleryProduct.imageIds.length;
  activeImageIndex = (activeImageIndex + direction + count) % count;
  updateGalleryImage();
}

function openOrderForm() {
  if (!activeGalleryProduct) return;

  openOrderRequest(activeGalleryProduct);
}

function openOrderRequest(product) {
  activeOrderProduct = product;
  if (elements.dialog.open) elements.dialog.close();
  elements.orderForm.reset();
  elements.orderForm.hidden = false;
  elements.orderMessage.value = "";
  elements.orderStatus.textContent = "";
  elements.orderResult.hidden = true;
  elements.openWhatsApp.hidden = true;
  elements.orderProduct.textContent = `${activeOrderProduct.name} · ${priceFormatter.format(activeOrderProduct.price)}`;
  elements.orderDialog.showModal();
}

function createOrderMessage(formData) {
  const landmark = formData.get("landmark").trim();
  const instructions = formData.get("instructions").trim();
  const addressLines = [
    `House / flat / building: ${formData.get("house").trim()}`,
    `Street / area / locality: ${formData.get("street").trim()}`,
    landmark ? `Landmark: ${landmark}` : "",
    `City: ${formData.get("city").trim()}`,
    `State: ${formData.get("state").trim()}`,
    `PIN code: ${formData.get("pin").trim()}`,
  ].filter(Boolean);

  return [
    `Hello ${storeName}, I would like to place an order request.`,
    "",
    `Product: ${activeOrderProduct.name}`,
    `Product ID: ${activeOrderProduct.id}`,
    `Price: ${priceFormatter.format(activeOrderProduct.price)}`,
    `Shoe size (UK / India): ${formData.get("size")}`,
    "",
    "Customer details:",
    `Name: ${formData.get("name").trim()}`,
    `Phone: ${formData.get("phone").trim()}`,
    "",
    "Delivery address:",
    ...addressLines,
    "",
    `Extra instructions: ${instructions || "None"}`,
    "",
    "Please confirm availability and delivery details. Thank you.",
  ].join("\n");
}

function handleOrderSubmit(event) {
  event.preventDefault();
  if (!activeOrderProduct) return;

  const phoneInput = elements.orderForm.elements.phone;
  const phoneDigits = phoneInput.value.replace(/\D/g, "");
  phoneInput.setCustomValidity(
    phoneDigits.length < 7 || phoneDigits.length > 15
      ? "Enter a phone number containing 7 to 15 digits."
      : "",
  );

  if (!elements.orderForm.reportValidity()) return;

  const formData = new FormData(elements.orderForm);
  const message = createOrderMessage(formData);
  elements.orderMessage.value = message;
  elements.orderForm.hidden = true;
  elements.orderResult.hidden = false;
  elements.orderStatus.textContent = "";

  const recipient = storeContact.replace(/\D/g, "");
  if (recipient.length >= 8 && recipient.length <= 15) {
    elements.openWhatsApp.href = `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
    elements.openWhatsApp.hidden = false;
  } else {
    elements.openWhatsApp.hidden = true;
    elements.orderStatus.textContent =
      "The store WhatsApp number is unavailable. You can still copy and share this message manually.";
  }

  elements.copyMessage.focus();
}

async function copyOrderMessage() {
  try {
    await navigator.clipboard.writeText(elements.orderMessage.value);
    elements.orderStatus.textContent =
      "Message copied. Open WhatsApp to send it to the store.";
  } catch {
    elements.orderMessage.focus();
    elements.orderMessage.select();
    elements.orderStatus.textContent =
      "Clipboard access is unavailable. The message is selected; copy it to continue.";
  }
}

async function loadCatalog() {
  elements.loading.hidden = false;
  elements.error.hidden = true;
  elements.warning.hidden = true;
  elements.grid.setAttribute("aria-busy", "true");

  try {
    const catalogUrl = new URL("../main.json", import.meta.url);
    let response;

    try {
      response = await fetch(catalogUrl, { cache: "no-cache" });
    } catch (error) {
      throw new Error(
        `Could not fetch the catalog from ${catalogUrl.href}. ${error.message || "Check your network connection."}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `The catalog request returned HTTP ${response.status} from ${response.url || catalogUrl.href}.`,
      );
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "main.json could not be read as valid JSON. Check its commas, quotes, and brackets.",
      );
    }

    const catalog = validateCatalog(data);
    products = catalog.products;
    storeName = catalog.storeName;
    storeContact =
      typeof data.store.contact === "string" ? data.store.contact : "";

    renderStoreDetails(data.store);
    document.querySelectorAll("[data-store-name]").forEach((element) => {
      element.textContent = catalog.storeName;
    });
    document.title = `${catalog.storeName} | Footwear collection`;

    if (catalog.issues.length) {
      elements.warning.textContent = `${catalog.issues.length} product ${catalog.issues.length === 1 ? "record was" : "records were"} skipped because the data is incomplete or invalid. Review the products array in main.json.`;
      elements.warning.hidden = false;
    }

    renderHeroProduct();
    selectForYouProducts();
    renderForYou();
    renderCatalog();
  } catch (error) {
    products = [];
    elements.grid.replaceChildren();
    elements.count.textContent = "";
    elements.errorMessage.textContent =
      error.message || "Check main.json and try again.";
    elements.error.hidden = false;
  } finally {
    elements.loading.hidden = true;
    elements.grid.setAttribute("aria-busy", "false");
  }
}

function setupGlassShader() {
  const canvas = document.querySelector("#glass-canvas");
  if (!canvas) return;

  const gl = canvas.getContext("webgl", {
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
  });
  if (!gl) {
    canvas.parentElement?.classList.add("glass-fallback");
    return;
  }

  const vertexSource = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision mediump float;
    varying vec2 vUv;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec2 uMouse;

    vec2 distort(vec2 uv, float intensity) {
      vec2 center = uv - 0.5;
      float dist = length(center);
      vec2 direction = normalize(center + 0.0001);
      return uv + direction * dist * dist * intensity;
    }

    void main() {
      vec2 uv = vUv;
      vec2 mouse = uMouse / max(uResolution.x, 1.0);
      vec2 adjustedMouse = vec2(mouse.x, 1.0 - mouse.y);
      float mouseInfluence = smoothstep(0.7, 0.0, distance(uv, adjustedMouse));
      vec2 warpedUv = distort(uv + (adjustedMouse - 0.5) * 0.12, 0.2 + mouseInfluence * 0.24);

      vec3 base = vec3(0.96, 0.88, 0.84);
      vec3 rose = vec3(0.82, 0.42, 0.46);
      vec3 cherry = vec3(0.41, 0.17, 0.22);
      vec3 glow = mix(base, rose, warpedUv.x * 0.7 + 0.1);
      float wave = sin((warpedUv.y + uTime * 0.15) * 14.0) * 0.08;
      float veil = sin((warpedUv.x * 12.0 - uTime * 0.2) + warpedUv.y * 9.0) * 0.08;
      vec3 color = mix(glow, cherry, 0.28 + wave + veil);
      color += vec3(1.0, 0.95, 0.92) * (0.12 + mouseInfluence * 0.08);
      float alpha = 0.22 + mouseInfluence * 0.12;
      gl_FragColor = vec4(color, alpha);
    }
  `;

  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(
        gl.getShaderInfoLog(shader) || "Shader compilation failed",
      );
    }
    return shader;
  };

  const program = gl.createProgram();
  if (!program) return;

  try {
    const vertex = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const resolutionLocation = gl.getUniformLocation(program, "uResolution");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const mouseLocation = gl.getUniformLocation(program, "uMouse");

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(200, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(160, Math.floor(canvas.clientHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const pointer = {
      x: canvas.clientWidth * 0.5,
      y: canvas.clientHeight * 0.5,
    };
    canvas.addEventListener("pointermove", (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    });

    function renderFrame(timeMs) {
      resize();
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, timeMs / 1000);
      gl.uniform2f(
        mouseLocation,
        pointer.x * (window.devicePixelRatio || 1),
        pointer.y * (window.devicePixelRatio || 1),
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(renderFrame);
    }

    requestAnimationFrame(renderFrame);
    window.addEventListener("resize", resize, { passive: true });
  } catch {
    canvas.parentElement?.classList.add("glass-fallback");
  }
}

function bindUi() {
  elements.search.addEventListener("input", () => {
    renderCatalog();
    const hasSearch = elements.search.value.trim().length > 0;
    if (hasSearch && previousSearchWasEmpty) scrollToCatalog();
    previousSearchWasEmpty = !hasSearch;
  });

  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderCatalog();
    scrollToCatalog();
  });

  elements.clearSearch.addEventListener("click", () => {
    elements.search.value = "";
    renderCatalog();
    previousSearchWasEmpty = true;
    elements.search.focus();
  });

  elements.sort.addEventListener("change", renderCatalog);
  elements.retry.addEventListener("click", loadCatalog);

  elements.menuToggle.addEventListener("click", () => {
    const isExpanded =
      elements.menuToggle.getAttribute("aria-expanded") === "true";
    elements.menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    elements.navigation.classList.toggle("is-open", !isExpanded);
  });

  elements.navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      elements.menuToggle.setAttribute("aria-expanded", "false");
      elements.navigation.classList.remove("is-open");
    });
  });

  elements.previousImage.addEventListener("click", () => moveGalleryImage(-1));
  elements.nextImage.addEventListener("click", () => moveGalleryImage(1));
  elements.closeGallery.addEventListener("click", () =>
    elements.dialog.close(),
  );
  elements.createOrder.addEventListener("click", openOrderForm);
  elements.closeOrder.addEventListener("click", () =>
    elements.orderDialog.close(),
  );
  elements.orderForm.addEventListener("submit", handleOrderSubmit);
  elements.copyMessage.addEventListener("click", copyOrderMessage);
  elements.editOrder.addEventListener("click", () => {
    elements.orderForm.hidden = false;
    elements.orderStatus.textContent = "";
    elements.orderForm.elements.name.focus();
  });

  elements.dialog.addEventListener("click", (event) => {
    if (event.target === elements.dialog) elements.dialog.close();
  });

  elements.dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") moveGalleryImage(-1);
    if (event.key === "ArrowRight") moveGalleryImage(1);
  });

  elements.dialog.addEventListener("close", () => {
    activeGalleryProduct = null;
    elements.galleryImage.replaceChildren();
  });

  elements.refreshForYou?.addEventListener("click", () => {
    selectForYouProducts();
    renderForYou();
  });
}

bindUi();
setupGlassShader();
loadCatalog();
