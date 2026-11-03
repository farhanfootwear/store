import {
  getVisibleProducts,
  renderProducts,
  validateCatalog,
} from "./products.js";
import { createProductImage } from "./utils.js";

const elements = {
  grid: document.querySelector("#product-grid"),
  search: document.querySelector("#product-search"),
  clearSearch: document.querySelector("#clear-search"),
  categoryButtons: [...document.querySelectorAll("[data-category]")],
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
};

let products = [];
let activeCategory = "all";
let activeGalleryProduct = null;
let activeImageIndex = 0;

function renderCatalog() {
  const visibleProducts = getVisibleProducts(
    products,
    activeCategory,
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
      "No footwear matches your search. Try another name or category.";
  }
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

async function loadCatalog() {
  elements.loading.hidden = false;
  elements.error.hidden = true;
  elements.warning.hidden = true;
  elements.grid.setAttribute("aria-busy", "true");

  try {
    const response = await fetch("./main.json", { cache: "no-cache" });
    if (!response.ok)
      throw new Error(`The catalog request returned HTTP ${response.status}.`);

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
      error instanceof TypeError
        ? "The catalog could not be reached. Use a local web server or check your network connection, then try again."
        : error.message || "Check main.json and try again.";
    elements.error.hidden = false;
  } finally {
    elements.loading.hidden = true;
    elements.grid.setAttribute("aria-busy", "false");
  }
}

elements.search.addEventListener("input", renderCatalog);
elements.clearSearch.addEventListener("click", () => {
  elements.search.value = "";
  renderCatalog();
  elements.search.focus();
});

elements.categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    elements.categoryButtons.forEach((categoryButton) => {
      const isActive = categoryButton === button;
      categoryButton.classList.toggle("is-active", isActive);
      categoryButton.setAttribute("aria-pressed", String(isActive));
    });
    renderCatalog();
  });
});

elements.sort.addEventListener("change", renderCatalog);
elements.retry.addEventListener("click", loadCatalog);
elements.menuToggle.addEventListener("click", () => {
  const isExpanded =
    elements.menuToggle.getAttribute("aria-expanded") === "true";
  elements.menuToggle.setAttribute("aria-expanded", String(!isExpanded));
  elements.navigation.classList.toggle("is-open", !isExpanded);
});

document.querySelectorAll("[data-nav-category]").forEach((link) => {
  link.addEventListener("click", () => {
    const category = link.dataset.navCategory;
    const filterButton = elements.categoryButtons.find(
      (button) => button.dataset.category === category,
    );
    filterButton?.click();
    elements.menuToggle.setAttribute("aria-expanded", "false");
    elements.navigation.classList.remove("is-open");
  });
});

elements.previousImage.addEventListener("click", () => moveGalleryImage(-1));
elements.nextImage.addEventListener("click", () => moveGalleryImage(1));
elements.closeGallery.addEventListener("click", () => elements.dialog.close());
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
