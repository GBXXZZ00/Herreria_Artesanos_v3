// Comprime una foto en el propio teléfono ANTES de subirla — se usa en todos los
// módulos que suban fotos (catálogo, abonos, producción, etc.). Reduce una foto de
// cámara (3-5 MB) a unos 150-300 KB sin pérdida visible, redimensionando al lado
// más largo indicado y exportando como JPEG de calidad media-alta.
function comprimirFoto(file, maxLado = 1280, calidad = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxLado) {
        height = Math.round(height * (maxLado / width));
        width = maxLado;
      } else if (height >= width && height > maxLado) {
        width = Math.round(width * (maxLado / height));
        height = maxLado;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('No se pudo comprimir la imagen'));
        resolve(blob);
      }, 'image/jpeg', calidad);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}
