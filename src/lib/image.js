// Turns a chosen picture into a small square data URL (centered crop), so it is
// only a few KB to store and send. Throws an Error with a user-friendly message.

const MAX_FILE_BYTES = 10 * 1024 * 1024; // refuse huge originals before decoding

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file couldn't be read as an image"));
    };
    img.src = url;
  });
}

export async function pictureToDataURL(file, size = 256) {
  if (!file || !/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type)) {
    throw new Error("Please choose a PNG, JPEG or WebP image");
  }
  if (file.size > MAX_FILE_BYTES) throw new Error("That image is too large (max 10 MB)");

  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new Error("That file couldn't be read as an image");

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  // WebP keeps transparency at a small size; fall back to PNG where unsupported
  let url = canvas.toDataURL("image/webp", 0.85);
  if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/png");
  return url;
}
