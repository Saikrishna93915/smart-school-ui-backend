import mongoose from "mongoose";

// Optional: ensure env is loaded if not already
// import dotenv from "dotenv";
// dotenv.config();

const connectDB = async () => {
  try {
    // Use MongoDB Atlas (production) with local fallback
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      throw new Error("❌ MONGODB_URI or MONGO_URI is missing in environment variables");
    }

    // Mongoose 7+ (no extra options needed)
    const conn = await mongoose.connect(mongoUri);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }

  // Graceful shutdown support (Ctrl+C etc.)
  mongoose.connection.on("disconnected", () => {
    console.log("⚠️ MongoDB disconnected");
  });
};

export default connectDB;
