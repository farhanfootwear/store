import { createProductImage } from "./utils.js";

const priceFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function validateCatalog(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The catalog must be a JSON object.");
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

  const products = [];
  const issues = [];
  const usedIds = new Set();

  data.products.forEach((product, index) => {
    const recordNumber = index + 1;
    const fail = (message) =>
      issues.push(`Product ${recordNumber}: ${message}`);

    if (!product || typeof product !== "object" || Array.isArray(product)) {
      fail("expected an object; this record was skipped.");
      return;
    }

    if (typeof product.id !== "string" || !product.id.trim()) {
      fail("id must be a non-empty string; this record was skipped.");
      return;
    }
    if (usedIds.has(product.id)) {
      fail(`id "${product.id}" is duplicated; this record was skipped.`);
      return;
    }
    usedIds.add(product.id);

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
        "image-id must be a non-empty array of image IDs using letters, numbers, hyphens, or underscores; this record was skipped.",
      );
      return;
    }

    products.push({
      id: product.id,
      name: product.name.trim(),
      price: product.price,
      imageIds: [...product["image-id"]],
    });
  });

  if (data.products.length > 0 && products.length === 0) {
    throw new Error(
      `No valid products were found. ${issues[0] || "Check product data in main.json."}`,
    );
  }

  return { storeName: data.store.name.trim(), products, issues };
}

export function getVisibleProducts(products, searchTerm, sortOrder) {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
  const visibleProducts = products.filter((product) =>
    product.name.toLocaleLowerCase().includes(normalizedSearch),
  );

  visibleProducts.sort((first, second) => {
    const comparison = first.name.localeCompare(second.name, undefined, {
      sensitivity: "base",
    });
    return sortOrder === "name-desc" ? -comparison : comparison;
  });
  return visibleProducts;
}

export function renderProducts(products, grid, onOpenGallery) {
  const fragment = document.createDocumentFragment();

  products.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.style.animationDelay = `${Math.min(index * 45, 225)}ms`;

    const imageButton = document.createElement("button");
    imageButton.className = "product-image-button";
    imageButton.type = "button";
    imageButton.setAttribute("aria-label", `View images of ${product.name}`);
    imageButton.append(createProductImage(product.imageIds[0], product.name));
    imageButton.addEventListener("click", () => onOpenGallery(product));

    const metadata = document.createElement("div");
    metadata.className = "product-meta";
    const imageCount = document.createElement("span");
    imageCount.className = "product-image-count";
    imageCount.textContent =
      product.imageIds.length > 1
        ? `${product.imageIds.length} images`
        : "View image";
    metadata.append(imageCount);

    const name = document.createElement("h3");
    name.className = "product-name";
    name.textContent = product.name;

    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = priceFormatter.format(product.price);

    card.append(imageButton, metadata, name, price);
    fragment.append(card);
  });

  grid.replaceChildren(fragment);
}
