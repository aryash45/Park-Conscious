/**
 * Open Graph images that preserve the event poster (portrait).
 * Uses a 3:4 frame so the full poster is visible — no landscape crop.
 */

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 1600; // 3:4 portrait (standard event poster)

const DEFAULT_OG_IMAGE = 'https://events.parkconscious.in/new_backstage.png';

/**
 * Build an absolute OG image URL using the event poster (not the landscape banner).
 */
export function getOgImageUrl(event, baseUrl = 'https://events.parkconscious.in') {
    const raw =
        event?.images?.[0] ||
        event?.image ||
        event?.bannerImage ||
        DEFAULT_OG_IMAGE;

    let url = raw.startsWith('http')
        ? raw
        : `${baseUrl}${raw.startsWith('/') ? raw : `/${raw}`}`;

    if (url.includes('res.cloudinary.com')) {
        // Fit entire poster inside portrait frame — no cropping
        const transform = `q_auto:good,f_jpg,w_${OG_IMAGE_WIDTH},h_${OG_IMAGE_HEIGHT},c_fit,b_black`;
        url = url.replace(/\/upload\/(?:v\d+\/)?/, `/upload/${transform}/`);
    }

    return url;
}
