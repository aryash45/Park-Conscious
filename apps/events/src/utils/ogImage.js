/** Client-side OG image URL — portrait poster (mirrors api/lib/ogImage.js). */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 1600;

export const getOgImageUrl = (event) => {
  const base = 'https://events.parkconscious.in';
  const raw =
    event?.images?.[0] ||
    event?.image ||
    event?.bannerImage ||
    `${base}/new_backstage.png`;

  let url = raw.startsWith('http') ? raw : `${base}${raw.startsWith('/') ? raw : `/${raw}`}`;

  if (url.includes('res.cloudinary.com')) {
    const transform = `q_auto:good,f_jpg,w_${OG_IMAGE_WIDTH},h_${OG_IMAGE_HEIGHT},c_fit,b_black`;
    url = url.replace(/\/upload\/(?:v\d+\/)?/, `/upload/${transform}/`);
  }

  return url;
};
