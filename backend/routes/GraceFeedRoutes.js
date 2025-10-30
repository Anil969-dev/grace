const express = require("express");
const router = express.Router();
const { body, param, query, validationResult } = require("express-validator");
const graceFeedService = require("../services/graceFeedService");
const multer = require("multer");
const {
  uploadImage,
  uploadVideo,
  uploadImageFromBuffer,
} = require("../services/imageStoreService");

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and video files are allowed!"), false);
    }
  },
});

// Upload endpoint for files
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { user, caption, size = "medium", tags } = req.body;

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Upload to Cloudinary
    let uploadResult;
    const isVideo = req.file.mimetype.startsWith("video/");

    if (isVideo) {
      // For videos, save temporarily and upload
      const fs = require("fs");
      const path = require("path");
      const tempPath = path.join(
        __dirname,
        "../temp_" + Date.now() + "_" + req.file.originalname
      );

      fs.writeFileSync(tempPath, req.file.buffer);
      uploadResult = await uploadVideo(tempPath, "grace-feed-videos");
      fs.unlinkSync(tempPath); // Clean up temp file
    } else {
      // For images, upload from buffer using the new function
      uploadResult = await uploadImageFromBuffer(
        req.file.buffer,
        "grace-feed-images"
      );
    }

    // Create post in database
    const postData = {
      user: user,
      type: isVideo ? "video" : "photo",
      content: uploadResult.url,
      contentPublicId: uploadResult.publicId,
      caption: caption || "",
      size: size,
      tags: tags ? JSON.parse(tags) : [],
    };

    const graceFeed = await graceFeedService.createPost(postData);

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      result: graceFeed,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Upload failed",
      error: error.message,
    });
  }
});

router.post(
  "/create",
  [
    body("user")
      .notEmpty()
      .withMessage("User Id is required")
      .isMongoId()
      .withMessage("Invalid User Id format"),
    body("type")
      .optional()
      .isIn(["photo", "video", "text"])
      .withMessage("Type must be either photo, video or text"),
    body("content").notEmpty().withMessage("Content is required"),
    body("caption")
      .optional()
      .isString()
      .withMessage("Caption must be a string"),
    body("size")
      .optional()
      .isIn(["small", "medium", "large"])
      .withMessage("Size must be either small, medium or large"),
    body("tags")
      .optional()
      .isArray()
      .withMessage("Tags must be an array of strings"),
    body("category")
      .optional()
      .isMongoId()
      .withMessage("Category must be a valid MongoDB ObjectId"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "validation errors",
        errors: errors.array(),
      });
    }
    try {
      const graceFeed = await graceFeedService.createPost(req.body);
      if (graceFeed) {
        res.status(201).json({
          success: true,
          message: "GraceFeed created successfully",
          result: graceFeed,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Failed to create GraceFeed",
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

router.get(
  "/",
  [
    query("user").optional().isMongoId().withMessage("Invalid User Id format"),
    query("category")
      .optional()
      .isMongoId()
      .withMessage("Category must be a valid MongoDB ObjectId"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    try {
      const { user, category } = req.query;
      const filter = {};
      if (user) {
        filter.user = user;
      }
      if (category) {
        filter.category = category;
      }

      // No pagination - return all posts
      const graceFeeds = await graceFeedService.readPosts(filter);
      const totalPosts = await graceFeedService.countPosts(filter);

      return res.status(200).json({
        success: true,
        message: "GraceFeeds retrieved successfully",
        result: {
          posts: graceFeeds,
          totalPosts,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

router.get(
  "/:id",
  [
    param("id")
      .notEmpty()
      .withMessage("ID is required")
      .isMongoId()
      .withMessage("Invalid ID format"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    try {
      const graceFeed = await graceFeedService.getPostById(req.params.id);
      if (graceFeed) {
        return res.status(200).json({
          success: true,
          message: "GraceFeed retrieved successfully",
          result: graceFeed,
        });
      } else {
        return res.status(404).json({
          success: false,
          message: "GraceFeed not found",
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

router.put(
  "/:id",
  [
    param("id")
      .notEmpty()
      .withMessage("ID is required")
      .isMongoId()
      .withMessage("Invalid ID format"),
    body("caption")
      .optional()
      .isString()
      .withMessage("Caption must be a string"),
    body("size")
      .optional()
      .isIn(["small", "medium", "large"])
      .withMessage("Size must be either small, medium or large"),
    body("tags")
      .optional()
      .isArray()
      .withMessage("Tags must be an array of strings"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    try {
      const GraceFeed = await graceFeedService.updatePost(
        {
          _id: req.params.id,
        },
        req.body
      );
      if (GraceFeed) {
        return res.status(200).json({
          success: true,
          message: "GraceFeed updated successfully",
          result: GraceFeed,
        });
      } else {
        return res.status(404).json({
          success: false,
          message: "GraceFeed not found",
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

router.delete(
  "/:id",
  [
    param("id")
      .notEmpty()
      .withMessage("ID is required")
      .isMongoId()
      .withMessage("Invalid ID format"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    try {
      await graceFeedService.deletePost({ _id: req.params.id });
      return res.status(200).json({
        success: true,
        message: "GraceFeed deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

router.post(
  "/:id/like",
  [
    param("id")
      .notEmpty()
      .withMessage("Post ID is required")
      .isMongoId()
      .withMessage("Invalid Post ID format"),
    body("userId")
      .notEmpty()
      .withMessage("User ID is required")
      .isMongoId()
      .withMessage("Invalid User ID format"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    try {
      const post = await graceFeedService.likePost(
        req.params.id,
        req.body.userId
      );
      return res.status(200).json({
        success: true,
        message: "Post like status updated successfully",
        result: post,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

router.post(
  "/:id/comment",
  [
    param("id")
      .notEmpty()
      .withMessage("Post ID is required")
      .isMongoId()
      .withMessage("Invalid Post ID format"),
    body("userId")
      .notEmpty()
      .withMessage("User ID is required")
      .isMongoId()
      .withMessage("Invalid User ID format"),
    body("text")
      .notEmpty()
      .withMessage("Comment text is required")
      .isLength({ min: 1, max: 500 })
      .withMessage("Comment must be between 1 and 500 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    try {
      const post = await graceFeedService.addComment(
        req.params.id,
        req.body.userId,
        req.body.text
      );
      return res.status(201).json({
        success: true,
        message: "Comment added successfully",
        result: post,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

router.post(
  "/:id/share",
  [
    param("id")
      .notEmpty()
      .withMessage("Post ID is required")
      .isMongoId()
      .withMessage("Invalid Post ID format"),
    body("userId")
      .notEmpty()
      .withMessage("User ID is required")
      .isMongoId()
      .withMessage("Invalid User ID format"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    try {
      const post = await graceFeedService.sharePost(
        req.params.id,
        req.body.userId
      );
      return res.status(200).json({
        success: true,
        message: "Post shared successfully",
        result: post,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

router.get("/count", async (req, res) => {
  try {
    const count = await graceFeedService.countPosts();
    return res.status(200).json({
      success: true,
      message: "Total posts count retrieved successfully",
      result: count,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
