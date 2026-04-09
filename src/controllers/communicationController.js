import ClassAnnouncement from '../models/ClassAnnouncement.js';
import asyncHandler from 'express-async-handler';

/**
 * @desc    Create an announcement
 * @route   POST /api/teacher/announcements
 * @access  Private (Teacher)
 */
export const createAnnouncement = asyncHandler(async (req, res) => {
  const {
    classId,
    sectionId,
    title,
    description,
    content,
    type,
    priority,
    visibility,
    attachments,
    schedulePublish,
    expiryDate
  } = req.body;

  // Validation
  if (!classId || !sectionId || !title || !description) {
    return res.status(400).json({
      success: false,
      message: 'Please provide all required fields'
    });
  }

  const announcement = await ClassAnnouncement.create({
    classId,
    sectionId,
    teacherId: req.user._id,
    title,
    description,
    content: content || description,
    type: type || 'general',
    priority: priority || 'normal',
    visibility: visibility || 'students',
    attachments: attachments || [],
    datePosted: new Date(),
    expiryDate,
    isActive: !schedulePublish,
    schedulePublish,
    isScheduled: !!schedulePublish
  });

  res.status(201).json({
    success: true,
    message: 'Announcement created successfully',
    data: announcement
  });
});

/**
 * @desc    Get announcements for a class
 * @route   GET /api/teacher/announcements/:classId
 * @access  Private (Teacher)
 */
export const getAnnouncementsByClass = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { type, priority, includeScheduled } = req.query;
  const teacherId = req.user._id;

  let query = {
    classId,
    teacherId
  };

  if (type) query.type = type;
  if (priority) query.priority = priority;
  if (includeScheduled !== 'true') {
    query.isActive = true; // Only active announcements by default
  }

  const announcements = await ClassAnnouncement.find(query)
    .sort({ datePosted: -1 });

  res.status(200).json({
    success: true,
    count: announcements.length,
    data: announcements
  });
});

/**
 * @desc    Get a specific announcement
 * @route   GET /api/teacher/announcements/:classId/:announcementId
 * @access  Private
 */
export const getAnnouncementById = asyncHandler(async (req, res) => {
  const { announcementId } = req.params;

  const announcement = await ClassAnnouncement.findByIdAndUpdate(
    announcementId,
    {
      $inc: { views: 1 },
      $push: {
        viewedBy: {
          userId: req.user._id,
          viewedAt: new Date()
        }
      }
    },
    { new: true }
  );

  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: 'Announcement not found'
    });
  }

  res.status(200).json({
    success: true,
    data: announcement
  });
});

/**
 * @desc    Update an announcement
 * @route   PUT /api/teacher/announcements/:id
 * @access  Private (Teacher)
 */
export const updateAnnouncement = asyncHandler(async (req, res) => {
  let announcement = await ClassAnnouncement.findOne({
    _id: req.params.id,
    teacherId: req.user._id
  });

  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: 'Announcement not found'
    });
  }

  announcement = await ClassAnnouncement.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    message: 'Announcement updated successfully',
    data: announcement
  });
});

/**
 * @desc    Delete an announcement
 * @route   DELETE /api/teacher/announcements/:id
 * @access  Private (Teacher)
 */
export const deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await ClassAnnouncement.findOneAndDelete({
    _id: req.params.id,
    teacherId: req.user._id
  });

  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: 'Announcement not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Announcement deleted successfully'
  });
});

/**
 * @desc    Publish a scheduled announcement
 * @route   PUT /api/teacher/announcements/:id/publish
 * @access  Private (Teacher)
 */
export const publishAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await ClassAnnouncement.findOneAndUpdate(
    {
      _id: req.params.id,
      teacherId: req.user._id
    },
    {
      isActive: true,
      isScheduled: false,
      schedulePublish: null,
      datePosted: new Date()
    },
    { new: true }
  );

  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: 'Announcement not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Announcement published successfully',
    data: announcement
  });
});

/**
 * @desc    Archive an announcement
 * @route   PUT /api/teacher/announcements/:id/archive
 * @access  Private (Teacher)
 */
export const archiveAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await ClassAnnouncement.findOneAndUpdate(
    {
      _id: req.params.id,
      teacherId: req.user._id
    },
    {
      isActive: false
    },
    { new: true }
  );

  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: 'Announcement not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Announcement archived successfully',
    data: announcement
  });
});

/**
 * @desc    Add comment to announcement
 * @route   PUT /api/teacher/announcements/:id/comment
 * @access  Private
 */
export const addCommentToAnnouncement = asyncHandler(async (req, res) => {
  const { comment } = req.body;

  if (!comment) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a comment'
    });
  }

  const announcement = await ClassAnnouncement.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        comments: {
          userId: req.user._id,
          comment,
          commentedAt: new Date()
        }
      }
    },
    { new: true }
  );

  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: 'Announcement not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Comment added successfully',
    data: announcement
  });
});

/**
 * @desc    Like/Unlike announcement
 * @route   PUT /api/teacher/announcements/:id/like
 * @access  Private
 */
export const toggleAnnouncementLike = asyncHandler(async (req, res) => {
  let announcement = await ClassAnnouncement.findById(req.params.id);

  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: 'Announcement not found'
    });
  }

  // Check if user already liked
  const userLiked = announcement.likedBy?.includes(req.user._id);

  if (userLiked) {
    // Unlike
    announcement = await ClassAnnouncement.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { likes: -1 },
        $pull: { likedBy: req.user._id }
      },
      { new: true }
    );
  } else {
    // Like
    announcement = await ClassAnnouncement.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { likes: 1 },
        $push: { likedBy: req.user._id }
      },
      { new: true }
    );
  }

  res.status(200).json({
    success: true,
    message: userLiked ? 'Announcement unliked' : 'Announcement liked',
    data: announcement
  });
});

/**
 * @desc    Get announcements statistics
 * @route   GET /api/teacher/announcements-stats/:classId
 * @access  Private (Teacher)
 */
export const getAnnouncementStats = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user._id;

  const announcements = await ClassAnnouncement.find({
    classId,
    teacherId
  });

  const stats = {
    total: announcements.length,
    active: announcements.filter(a => a.isActive).length,
    archived: announcements.filter(a => !a.isActive).length,
    scheduled: announcements.filter(a => a.isScheduled).length,
    byType: {
      general: announcements.filter(a => a.type === 'general').length,
      academic: announcements.filter(a => a.type === 'academic').length,
      event: announcements.filter(a => a.type === 'event').length,
      exam: announcements.filter(a => a.type === 'exam').length,
      assignment: announcements.filter(a => a.type === 'assignment').length,
      emergency: announcements.filter(a => a.type === 'emergency').length
    },
    byPriority: {
      normal: announcements.filter(a => a.priority === 'normal').length,
      high: announcements.filter(a => a.priority === 'high').length,
      urgent: announcements.filter(a => a.priority === 'urgent').length
    },
    totalViews: announcements.reduce((sum, a) => sum + a.views, 0),
    totalLikes: announcements.reduce((sum, a) => sum + a.likes, 0),
    totalComments: announcements.reduce((sum, a) => sum + a.comments.length, 0),
    mostViewedAnnouncements: announcements
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)
      .map(a => ({
        _id: a._id,
        title: a.title,
        views: a.views,
        likes: a.likes
      }))
  };

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Get engagement report for an announcement
 * @route   GET /api/teacher/announcements/:id/engagement
 * @access  Private (Teacher)
 */
export const getAnnouncementEngagement = asyncHandler(async (req, res) => {
  const announcement = await ClassAnnouncement.findById(req.params.id);

  if (!announcement) {
    return res.status(404).json({
      success: false,
      message: 'Announcement not found'
    });
  }

  const engagement = {
    title: announcement.title,
    totalViews: announcement.views,
    uniqueViewers: announcement.viewedBy.length,
    totalLikes: announcement.likes,
    totalComments: announcement.comments.length,
    engagement_rate: (
      ((announcement.viewedBy.length + announcement.likes + announcement.comments.length) / 
       (announcement.viewedBy.length || 1)) * 100
    ).toFixed(2),
    recentComments: announcement.comments.slice(-5),
    viewHistory: announcement.viewedBy.slice(-10)
  };

  res.status(200).json({
    success: true,
    data: engagement
  });
});

export default {
  createAnnouncement,
  getAnnouncementsByClass,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  addCommentToAnnouncement,
  toggleAnnouncementLike,
  getAnnouncementStats,
  getAnnouncementEngagement
};
