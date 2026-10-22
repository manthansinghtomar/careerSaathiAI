require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const seedAdmin = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error(
      'Security Error: ADMIN_EMAIL and ADMIN_PASSWORD must be configured in environment variables to seed the Admin.'
    );
    process.exit(1);
  }

  if (adminPassword.length < 8) {
    console.error('Security Error: ADMIN_PASSWORD must be at least 8 characters long.');
    process.exit(1);
  }

  try {
    await connectDB();

    const normalizedEmail = adminEmail.toLowerCase().trim();
    const existingAdmin = await User.findOne({ email: normalizedEmail });

    if (existingAdmin) {
      console.log(`Admin account with email "${normalizedEmail}" already exists. No changes made.`);
      await mongoose.disconnect();
      process.exit(0);
    }

    const admin = new User({
      name: 'Platform Administrator',
      email: normalizedEmail,
      password: adminPassword,
      role: 'admin',
      preferredLanguage: 'en',
      careerProfile: {
        targetRole: 'Platform Administration',
        targetTimeline: 'N/A',
        currentSkillLevel: 'advanced',
        focusSkills: ['System Administration', 'Security', 'User Management'],
      },
      gamification: {
        xp: 1000,
        level: 10,
        streakCount: 1,
        lastActiveDate: new Date(),
      },
      isActive: true,
    });

    await admin.save();
    console.log(`Admin account [${normalizedEmail}] created successfully.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed Admin account:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

seedAdmin();
