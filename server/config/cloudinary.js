const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Dynamically check Cloudinary configuration at request time
const getCloudinaryConfig = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudinaryUrl = process.env.CLOUDINARY_URL;

  const isConfigured = Boolean(
    cloudinaryUrl || (cloudName && apiKey && apiSecret)
  );

  return { cloudName, apiKey, apiSecret, cloudinaryUrl, isConfigured };
};

/**
 * Saves file buffer to local filesystem
 */
const saveToLocalStorage = (file, folder) => {
  const localDirPath = path.join(__dirname, '..', folder);
  if (!fs.existsSync(localDirPath)) {
    fs.mkdirSync(localDirPath, { recursive: true });
  }

  const filename = Date.now() + "-" + (file.originalname || 'file');
  const filePath = path.join(localDirPath, filename);
  fs.writeFileSync(filePath, file.buffer);

  const localUrl = `/${folder}/${filename}`;
  console.log(`[LOCAL STORAGE FALLBACK] Saved ${file.originalname} to ${localUrl}`);
  return localUrl;
};

/**
 * Uploads media file to Cloudinary if configured, or saves to local disk as fallback.
 * @param {Object} file - Multer file object with buffer
 * @param {String} folder - Directory/folder name ('uploads' or 'profile-images')
 * @returns {Promise<String>} Public URL of uploaded image/file
 */
const uploadMedia = async (file, folder = 'uploads') => {
  if (!file) {
    console.log("[MEDIA UPLOAD] No file provided.");
    return null;
  }

  console.log(`\n========================================`);
  console.log(`[MEDIA UPLOAD START] File: ${file.originalname} (${file.size} bytes), Folder: ${folder}`);

  const config = getCloudinaryConfig();

  if (config.isConfigured) {
    console.log(`[CLOUDINARY CONFIG] Cloudinary IS configured. Cloud Name: ${config.cloudName || 'Using CLOUDINARY_URL'}`);
    try {
      if (config.cloudinaryUrl) {
        cloudinary.config();
      } else {
        cloudinary.config({
          cloud_name: config.cloudName,
          api_key: config.apiKey,
          api_secret: config.apiSecret,
        });
      }

      const secureUrl = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `sharexp/${folder}`,
            resource_type: "auto",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          }
        );
        uploadStream.end(file.buffer);
      });

      console.log(`[CLOUDINARY SUCCESS] Successfully uploaded to Cloudinary: ${secureUrl}`);
      console.log(`========================================\n`);
      return secureUrl;
    } catch (cloudinaryError) {
      console.error(
        `[CLOUDINARY ERROR] Upload failed: ${cloudinaryError.message || cloudinaryError}`
      );
      console.log(`[CLOUDINARY FALLBACK] Falling back to local storage...`);
      const fallbackUrl = saveToLocalStorage(file, folder);
      console.log(`========================================\n`);
      return fallbackUrl;
    }
  } else {
    console.log(`[CLOUDINARY CONFIG] Cloudinary is NOT configured. Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.`);
    console.log(`[CLOUDINARY FALLBACK] Saving directly to local storage...`);
    const fallbackUrl = saveToLocalStorage(file, folder);
    console.log(`========================================\n`);
    return fallbackUrl;
  }
};

module.exports = {
  cloudinary,
  getCloudinaryConfig,
  uploadMedia,
};
