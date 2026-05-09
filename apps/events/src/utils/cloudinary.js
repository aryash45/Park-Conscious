import axios from 'axios';

/**
 * apps/events/src/utils/cloudinary.js
 *
 * Purpose: Frontend-to-Cloudinary media upload utility for the Events portal.
 * Enables direct media uploads bypassing Vercel serverless payload limits.
 * Supports images, PDFs, and presentations via automatic resource type detection.
 *
 * @param {File} file - The file object from a file input
 * @returns {Promise<string>} - The secure URL of the uploaded resource
 */
export const uploadToCloudinary = async (file) => {
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dlyx0r3nn';
  const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'park_conscious';

  if (!file) {
    throw new Error('No file selected.');
  }

  const isDocument = file.name.toLowerCase().match(/\.(pdf|ppt|pptx|doc|docx)$/);
  const resourceType = isDocument ? 'raw' : 'auto';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('tags', 'nexus_event,temp_asset');

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      formData
    );

    if (response.data && response.data.secure_url) {
      console.log('%c[MEDIA_SYNC] Cloudinary Uplink Successful:', 'color: #10b981;', response.data.secure_url);
      return response.data.secure_url;
    } else {
      throw new Error('Upload response missing link.');
    }
  } catch (error) {
    console.error('[CLOUDINARY_UPLOAD_ERROR]:', error);
    const message = error.response?.data?.error?.message || error.message || 'Unknown upload error.';
    throw new Error(`Upload Failed: ${message}`);
  }
};
