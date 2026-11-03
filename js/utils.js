export function resolveImagePath(imageId) {
  return `images/${encodeURIComponent(imageId)}.jpg`;
}

export function createProductImage(
  imageId,
  productName,
  { eager = false } = {},
) {
  const frame = document.createElement("span");
  frame.className = "product-image-frame";

  const image = document.createElement("img");
  image.src = resolveImagePath(imageId);
  image.alt = `${productName}, product image`;
  image.width = 800;
  image.height = 600;
  image.loading = eager ? "eager" : "lazy";
  image.decoding = "async";

  const fallback = document.createElement("span");
  fallback.className = "image-placeholder";
  fallback.hidden = true;
  fallback.setAttribute("role", "img");
  fallback.setAttribute("aria-label", `Image unavailable for ${productName}`);

  const fallbackTitle = document.createElement("strong");
  fallbackTitle.textContent = productName;
  const fallbackMessage = document.createElement("span");
  fallbackMessage.textContent = "Product photo unavailable";
  fallback.append(fallbackTitle, fallbackMessage);

  image.addEventListener(
    "error",
    () => {
      image.hidden = true;
      fallback.hidden = false;
    },
    { once: true },
  );

  frame.append(image, fallback);
  return frame;
}

export function isSafeImageId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]+$/.test(value);
}
