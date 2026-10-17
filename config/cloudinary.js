const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for product color images
const productImagesStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "rentangadi/products/images",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  },
});

const uploadProductImages = multer({ storage: productImagesStorage });

// Storage for the main product images (ProductIcon + ProductImg1..3)
const productMainStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "rentangadi/products/main",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  },
});

const uploadProductMain = multer({ storage: productMainStorage });

// Storage for subcategory images
const subcategoryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "rentangadi/subcategory",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  },
});

const uploadSubcategory = multer({ storage: subcategoryStorage });

module.exports = {
  cloudinary,
  uploadProductImages,
  uploadProductMain,
  uploadSubcategory,
};
