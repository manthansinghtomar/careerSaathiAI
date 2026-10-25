require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const seedTrainer = async () => {
  const trainerEmail = process.env.TRAINER_EMAIL || 'trainer@careersaathi.ai';
  const trainerPassword = process.env.TRAINER_PASSWORD || 'Trainer@1234';

  try {
    await connectDB();

    const normalizedEmail = trainerEmail.toLowerCase().trim();
    let trainer = await User.findOne({ email: normalizedEmail });

    if (!trainer) {
      trainer = new User({
        name: 'Lead Technical Trainer',
        email: normalizedEmail,
        password: trainerPassword,
        role: 'trainer',
        preferredLanguage: 'en',
        careerProfile: {
          targetRole: 'Full Stack Mentor',
          targetTimeline: 'N/A',
          currentSkillLevel: 'advanced',
          focusSkills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
        },
        gamification: {
          xp: 500,
          level: 5,
          streakCount: 1,
          lastActiveDate: new Date(),
        },
        isActive: true,
      });

      await trainer.save();
      console.log(`[SUCCESS] Trainer created: ${normalizedEmail} / ${trainerPassword}`);
    } else {
      trainer.password = trainerPassword;
      trainer.role = 'trainer';
      trainer.isActive = true;
      await trainer.save();
      console.log(`[UPDATED] Trainer password reset: ${normalizedEmail} / ${trainerPassword}`);
    }

    // Automatically assign existing active students to this trainer so the cohort is populated
    const students = await User.find({ role: 'student', isActive: true });
    if (students.length > 0) {
      await User.updateMany(
        { role: 'student', isActive: true },
        { $set: { assignedTrainer: trainer._id } }
      );
      console.log(`[ASSIGNED] Assigned ${students.length} student(s) to trainer ${trainer.name}.`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed trainer account:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

seedTrainer();
