// Canvas-based crop, used by AvatarCropModal to turn react-easy-crop's
// pixel-area selection into an uploadable file. Always flattens to a
// static JPEG square — an animated GIF selected for cropping loses its
// animation here, same trade-off most apps make once cropping is in play.
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', reject)
    image.crossOrigin = 'anonymous'
    image.src = src
  })
}

export async function getCroppedImageBlob(imageSrc, croppedAreaPixels, outputSize = 512) {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')
  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outputSize,
    outputSize
  )
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92)
  })
}
