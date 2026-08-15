const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Check if Cloudinary credentials are configured
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_URL || 
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

if (isCloudinaryConfigured) {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config();
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
}

/**
 * Uploads media file to Cloudinary if configured, or saves to local disk as fallback.
 * @param {Object} file - Multer file object with buffer
 * @param {String} folder - Directory/folder name ('uploads' or 'profile-images')
 * @returns {Promise<String>} Public URL of uploaded image/file
 */
const uploadMedia = async (file, folder = 'uploads') => {
  if (!file) return null;

  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
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
  }

  // Local filesystem fallback
  const localDirPath = path.join(__dirname, '..', folder);
  if (!fs.existsSync(localDirPath)) {
    fs.mkdirSync(localDirPath, { recursive: true });
  }

  const filename = Date.now() + "-" + (file.originalname || 'file');
  const filePath = path.join(localDirPath, filename);
  fs.writeFileSync(filePath, file.buffer);

  return `/${folder}/${filename}`;
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadMedia,
};
