import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import * as settingController from "../controllers/settingsControllerNew.js";

const router = express.Router();
  getAllSettings: (req, res) => {
    res.json({
      success: true,
      message: 'Get all settings',
      data: {
        schoolInfo: {
          name: "Silver Sand International School",
          code: "SSIS-2024-001",
          email: "info@silversand.edu",
          phone: "+91 11 2654 9876",
          address: "123 Knowledge Park, Sector 62, Noida, Uttar Pradesh - 201309",
          established: "2005",
          principal: "Dr. Ramesh Kumar",
          board: "CBSE",
          medium: "English",
          website: "https://silversand.edu",
          motto: "Excellence Through Innovation",
          logo: null
        },
        academicYear: {
          current: "2024-25",
          startDate: "2024-04-01",
          endDate: "2025-03-31",
          terms: 2,
          sessions: ['April-September', 'October-March']
        },
        notifications: [
          { id: 1, name: 'Attendance Alerts', channels: ['email', 'sms', 'whatsapp'], enabled: true },
          { id: 2, name: 'Fee Reminders', channels: ['email', 'sms'], enabled: true },
          { id: 3, name: 'Exam Notifications', channels: ['email', 'whatsapp'], enabled: true },
          { id: 4, name: 'AI Insights', channels: ['email'], enabled: true },
          { id: 5, name: 'Emergency Alerts', channels: ['sms', 'whatsapp', 'voice'], enabled: true }
        ],
        security: {
          twoFactor: true,
          sessionTimeout: 30,
          passwordAge: 90,
          failedAttempts: 3
        },
        billing: {
          plan: 'Enterprise Plan',
          status: 'active',
          price: '₹24,999',
          period: 'month',
          students: 1248,
          staff: 45,
          storage: '250 GB'
        },
        systemHealth: {
          uptime: '99.95%',
          responseTime: '128ms',
          storage: '45%',
          memory: '68%',
          cpu: '32%',
          activeUsers: 142
        }
      }
    });
  },
  
  getSettingsByCategory: (req, res) => {
    const { category } = req.params;
    
    const categories = {
      school: {
        name: "Silver Sand International School",
        code: "SSIS-2024-001",
        email: "info@silversand.edu",
        phone: "+91 11 2654 9876"
      },
      academic: {
        current: "2024-25",
        startDate: "2024-04-01",
        endDate: "2025-03-31"
      },
      notifications: [
        { id: 1, name: 'Attendance Alerts', enabled: true },
        { id: 2, name: 'Fee Reminders', enabled: true }
      ],
      security: {
        twoFactor: true,
        sessionTimeout: 30
      },
      billing: {
        plan: 'Enterprise Plan',
        status: 'active',
        price: '₹24,999'
      },
      health: {
        uptime: '99.95%',
        responseTime: '128ms',
        activeUsers: 142
      }
    };
    
    if (categories[category]) {
      res.json({
        success: true,
        message: `Settings for ${category}`,
        data: categories[category]
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }
  },
  
  updateSchoolProfile: (req, res) => {
    const updates = req.body;
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('settings-changed', {
        category: 'school',
        changes: updates,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'School profile updated successfully',
      data: updates
    });
  },
  
  updateAcademicSettings: (req, res) => {
    const updates = req.body;
    
    const io = req.app.get('io');
    if (io) {
      io.emit('settings-changed', {
        category: 'academic',
        changes: updates,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Academic settings updated successfully',
      data: updates
    });
  },
  
  updateNotificationSettings: (req, res) => {
    const updates = req.body;
    
    const io = req.app.get('io');
    if (io) {
      io.emit('settings-changed', {
        category: 'notifications',
        changes: updates,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: updates
    });
  },
  
  updateSecuritySettings: (req, res) => {
    const updates = req.body;
    
    const io = req.app.get('io');
    if (io) {
      io.emit('settings-changed', {
        category: 'security',
        changes: updates,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Security settings updated successfully',
      data: updates
    });
  },
  
  updateBillingSettings: (req, res) => {
    const updates = req.body;
    
    const io = req.app.get('io');
    if (io) {
      io.emit('settings-changed', {
        category: 'billing',
        changes: updates,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Billing settings updated successfully',
      data: updates
    });
  },
  
  updateAdvancedSettings: (req, res) => {
    const updates = req.body;
    
    const io = req.app.get('io');
    if (io) {
      io.emit('settings-changed', {
        category: 'advanced',
        changes: updates,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Advanced settings updated successfully',
      data: updates
    });
  },
  
  createBackup: (req, res) => {
    const backupId = Date.now();
    
    // Simulate backup progress via socket
    const io = req.app.get('io');
    if (io) {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        io.emit('backup-status', {
          backupId,
          progress,
          status: progress < 100 ? 'in-progress' : 'completed'
        });
        
        if (progress >= 100) {
          clearInterval(interval);
        }
      }, 500);
    }
    
    res.json({
      success: true,
      message: "Backup initiated",
      backupId,
      estimatedTime: "30 seconds"
    });
  },
  
  exportData: (req, res) => {
    const { format } = req.body;
    const exportId = Date.now();
    
    res.json({
      success: true,
      message: "Export initiated",
      exportId,
      downloadUrl: `/api/settings/exports/${exportId}.${format || 'json'}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  },
  
  getSystemHealth: (req, res) => {
    res.json({
      success: true,
      message: "System health status",
      data: {
        uptime: '99.95%',
        responseTime: '128ms',
        storage: '45%',
        memory: '68%',
        cpu: '32%',
        activeUsers: 142,
        database: 'connected',
        services: ['API', 'Database', 'Cache']
      }
    });
  },
  
  uploadLogo: (req, res) => {
    const file = req.file;
    
    res.json({
      success: true,
      message: "Logo uploaded successfully",
      data: {
        filename: file.filename,
        path: file.path,
        size: file.size
      }
    });
  }
};

// =================== SETTINGS ROUTES ===================
// @route   GET /api/settings
// @desc    Get all settings
// @access  Private (Admin)
router.get("/", protect, authorize("admin", "owner"), settingController.getAllSettings);

// @route   GET /api/settings/:category
// @desc    Get settings by category
// @access  Private (Admin)
router.get("/:category", protect, authorize("admin", "owner"), settingController.getSettingsByCategory);

// @route   PUT /api/settings/school
// @desc    Update school profile
// @access  Private (Admin)
router.put("/school", protect, authorize("admin", "owner"), settingController.updateSchoolProfile);

// @route   PUT /api/settings/academic
// @desc    Update academic settings
// @access  Private (Admin)
router.put("/academic", protect, authorize("admin", "owner"), settingController.updateAcademicSettings);

// @route   PUT /api/settings/notifications
// @desc    Update notification settings
// @access  Private (Admin)
router.put("/notifications", protect, authorize("admin", "owner"), settingController.updateNotificationSettings);

// @route   PUT /api/settings/security
// @desc    Update security settings
// @access  Private (Admin)
router.put("/security", protect, authorize("admin", "owner"), settingController.updateSecuritySettings);

// @route   PUT /api/settings/billing
// @desc    Update billing settings
// @access  Private (Admin)
router.put("/billing", protect, authorize("admin", "owner"), settingController.updateBillingSettings);

// @route   PUT /api/settings/advanced
// @desc    Update advanced settings
// @access  Private (Admin)
router.put("/advanced", protect, authorize("admin", "owner"), settingController.updateAdvancedSettings);

// @route   POST /api/settings/backup
// @desc    Create system backup
// @access  Private (Admin)
router.post("/backup", protect, authorize("admin", "owner"), settingController.createBackup);

// @route   POST /api/settings/export
// @desc    Export data
// @access  Private (Admin)
router.post("/export", protect, authorize("admin", "owner"), settingController.exportData);

// @route   GET /api/settings/health
// @desc    Get system health
// @access  Private (Admin)
router.get("/health", protect, authorize("admin", "owner"), settingController.getSystemHealth);

// @route   POST /api/settings/logo
// @desc    Upload school logo
// @access  Private (Admin)
router.post("/logo", protect, authorize("admin", "owner"), settingController.uploadLogo);

// Health check for settings module
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Settings module is running",
    timestamp: new Date().toISOString(),
    endpoints: [
      "GET /api/settings",
      "GET /api/settings/:category",
      "PUT /api/settings/school",
      "PUT /api/settings/academic",
      "PUT /api/settings/notifications",
      "PUT /api/settings/security",
      "PUT /api/settings/billing",
      "PUT /api/settings/advanced",
      "POST /api/settings/backup",
      "POST /api/settings/export",
      "GET /api/settings/health"
    ]
  });
});

export default router;