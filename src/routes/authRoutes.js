import express from "express";
import {
  login,
  register,
  changePassword,
  logout,
  updateProfile
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { loginRateLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// CRITICAL: Registration restricted to admin/owner only (prevent unauthorized user creation)
router.post("/register", protect, loginRateLimiter, register);
// CRITICAL: Rate limit login (prevent brute force)
router.post("/login", loginRateLimiter, login);
router.post("/logout", logout);
router.put("/change-password", protect, changePassword);
router.put("/profile", protect, updateProfile);

export default router;
