import express from "express";
import {
  login,
  register,
  changePassword,
  logout,
  updateProfile
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.put("/change-password", protect, changePassword);
router.put("/profile", protect, updateProfile);

export default router;
