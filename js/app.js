import {
  getVisibleProducts,
  renderProducts,
  validateCatalog,
} from "./products.js";
import { createProductImage } from "./utils.js";

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
  orderProduct: document.querySelector("#order-product"),
  orderResult: document.querySelector("#order-result"),
  orderMessage: document.querySelector("#whatsapp-message"),
  orderStatus: document.querySelector("#order-status"),
  copyMessage: document.querySelector("#copy-message"),
  openWhatsApp: document.querySelector("#open-whatsapp"),
  editOrder: document.querySelector("#edit-order"),
  storeAddressRow: document.querySelector("#store-address-row"),
  storeAddress: document.querySelector("#store-address"),
  storePhoneRow: document.querySelector("#store-phone-row"),
  storePhone: document.querySelector("#store-phone"),
  storeLocationRow: document.querySelector("#store-location-row"),
  storeLocation: document.querySelector("#store-location"),
};

let products = [];
let activeGalleryProduct = null;
let activeOrderProduct = null;
let activeImageIndex = 0;
let storeName = "";
let storeContact = "";
let previousSearchWasEmpty = true;

const priceFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function renderCatalog() {
  const visibleProducts = getVisibleProducts(
    products,
    elements.search.value,
    elements.sort.value,
  );
  renderProducts(visibleProducts, elements.grid, openGallery);
  elements.count.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? "item" : "items"}`;
  elements.clearSearch.hidden = elements.search.value.length === 0;
  elements.empty.hidden = visibleProducts.length > 0 || products.length === 0;

  if (products.length === 0) {
    elements.empty.textContent =
      "The collection is being prepared. Please check back soon.";
  } else if (visibleProducts.length === 0) {
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
  const location =
    typeof store.location === "string" ? store.location.trim() : "";

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

  try {
    const mapUrl = new URL(location);
    if (mapUrl.protocol === "https:" || mapUrl.protocol === "http:") {
      elements.storeLocation.href = mapUrl.href;
      elements.storeLocationRow.hidden = false;
      return;
    }
  } catch {}
  elements.storeLocationRow.hidden = true;
}

function openGallery(product) {
  activeGalleryProduct = product;
  activeImageIndex = 0;
  elements.galleryTitle.textContent = product.name;
  updateGalleryImage();
  if (!elements.dialog.open) elements.dialog.showModal();
}

function updateGalleryImage() {
  if (!activeGalleryProduct) return;
  const { imageIds, name } = activeGalleryProduct;
  elements.galleryImage.replaceChildren(
    createProductImage(imageIds[activeImageIndex], name, { eager: true }),
  );
  elements.galleryCount.textContent = `Image ${activeImageIndex + 1} of ${imageIds.length}`;
  const hasMultipleImages = imageIds.length > 1;
  elements.previousImage.hidden = !hasMultipleImages;
  elements.nextImage.hidden = !hasMultipleImages;
}

function moveGalleryImage(direction) {
  if (!activeGalleryProduct || activeGalleryProduct.imageIds.length < 2) return;
  const imageCount = activeGalleryProduct.imageIds.length;
  activeImageIndex = (activeImageIndex + direction + imageCount) % imageCount;
  updateGalleryImage();
}

function openOrderForm() {
  if (!activeGalleryProduct) return;
  activeOrderProduct = activeGalleryProduct;
  elements.dialog.close();
  elements.orderForm.reset();
  elements.orderForm.hidden = false;
  elements.orderResult.hidden = true;
  elements.orderStatus.textContent = "";
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
elements.closeGallery.addEventListener("click", () => elements.dialog.close());
elements.createOrder.addEventListener("click", openOrderForm);
elements.closeOrder.addEventListener("click", () =>
  elements.orderDialog.close(),
);
elements.orderForm.addEventListener("submit", handleOrderSubmit);
elements.copyMessage.addEventListener("click", copyOrderMessage);
elements.editOrder.addEventListener("click", () => {
  elements.orderResult.hidden = true;
  elements.orderForm.hidden = false;
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

loadCatalog();
