import mongoose from 'mongoose';

const classAnnouncementSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    sectionId: {
      type: String,
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Announcement description is required']
    },
    content: {
      type: String,
      default: ''
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileType: String,
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    priority: {
      type: String,
      enum: ['normal', 'high', 'urgent'],
      default: 'normal'
    },
    type: {
      type: String,
      enum: ['general', 'academic', 'event', 'exam', 'assignment', 'emergency'],
      default: 'general'
    },
    datePosted: {
      type: Date,
      default: Date.now
    },
    expiryDate: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    visibility: {
      type: String,
      enum: ['students', 'parents', 'both', 'all'],
      default: 'both'
    },
    // Engagement Tracking
    views: {
      type: Number,
      default: 0
    },
    viewedBy: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        viewedAt: { type: Date, default: Date.now }
      }
    ],
    likes: {
      type: Number,
      default: 0
    },
    comments: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        comment: String,
        commentedAt: { type: Date, default: Date.now }
      }
    ],
    // Notifications
    notificationsSent: {
      type: Boolean,
      default: false
    },
    sentTo: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        sentAt: { type: Date, default: Date.now }
      }
    ],
    // Publishing Options
    schedulePublish: {
      type: Date,
      default: null
    },
    isScheduled: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Indexes
classAnnouncementSchema.index({ classId: 1, sectionId: 1 });
classAnnouncementSchema.index({ teacherId: 1 });
classAnnouncementSchema.index({ datePosted: -1 });
classAnnouncementSchema.index({ isActive: 1 });
classAnnouncementSchema.index({ priority: 1 });
classAnnouncementSchema.index({ expiryDate: 1 });

export default mongoose.model('ClassAnnouncement', classAnnouncementSchema);
