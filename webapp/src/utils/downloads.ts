export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function diagramPNG(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not prepare the diagram for PNG export.'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth * 2
    canvas.height = image.naturalHeight * 2
    const context = canvas.getContext('2d')
    if (!context) throw new Error('PNG export is unavailable in this browser.')
    context.scale(2, 2)
    context.fillStyle = 'white'
    context.fillRect(0, 0, image.naturalWidth, image.naturalHeight)
    context.drawImage(image, 0, 0)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not create the PNG file.'))),
        'image/png',
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
