import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Subject from '../src/models/Subject.js';
import Syllabus from '../src/models/Syllabus.js';
import User from '../src/models/User.js';
import connectDB from '../src/config/db.js';

dotenv.config();

const CLASSES = ['LKG', 'UKG', '1st Class', '2nd Class', '3rd Class', '4th Class', '5th Class', '6th Class', '7th Class', '8th Class', '9th Class', '10th Class'];
const SECTIONS = ['A', 'B'];
const ACADEMIC_YEAR = '2025-2026';

// Function to get chapters based on subject name pattern
const getChaptersForSubject = (subjectName) => {
  // Default chapters template
  const defaultChapters = [
    { chapterNumber: 1, chapterName: `Introduction to ${subjectName}`, description: 'Basic concepts and overview', topics: [{ topicName: 'Overview' }, { topicName: 'Fundamentals' }], learningOutcomes: [`Understand ${subjectName} basics`, 'Learn fundamental concepts'] },
    { chapterNumber: 2, chapterName: `${subjectName} Fundamentals`, description: 'Core principles and theory', topics: [{ topicName: 'Key concepts' }, { topicName: 'Basic theory' }], learningOutcomes: ['Apply core principles', 'Understand theory'] },
    { chapterNumber: 3, chapterName: `Practical ${subjectName}`, description: 'Hands-on practice and application', topics: [{ topicName: 'Practice exercises' }, { topicName: 'Real-world examples' }], learningOutcomes: ['Practice concepts', 'Apply in real scenarios'] },
    { chapterNumber: 4, chapterName: `Advanced ${subjectName}`, description: 'Advanced topics and concepts', topics: [{ topicName: 'Complex topics' }, { topicName: 'Advanced concepts' }], learningOutcomes: ['Master advanced concepts', 'Handle complex problems'] },
    { chapterNumber: 5, chapterName: `${subjectName} Review`, description: 'Comprehensive revision', topics: [{ topicName: 'Revision' }, { topicName: 'Summary' }], learningOutcomes: ['Review all topics', 'Consolidate learning'] }
  ];

  // Check for English
  if (subjectName.toLowerCase().includes('english')) {
    return [
      { chapterNumber: 1, chapterName: 'The Alphabet', description: 'Learning A-Z', topics: [{ topicName: 'Capital Letters' }, { topicName: 'Small Letters' }], learningOutcomes: ['Identify all 26 letters', 'Write uppercase and lowercase letters'] },
      { chapterNumber: 2, chapterName: 'Vowels and Consonants', description: 'Understanding vowels and consonants', topics: [{ topicName: 'A, E, I, O, U' }, { topicName: 'Other Letters' }], learningOutcomes: ['Differentiate vowels from consonants'] },
      { chapterNumber: 3, chapterName: 'Simple Words', description: 'Building vocabulary', topics: [{ topicName: '3-letter words' }, { topicName: '4-letter words' }], learningOutcomes: ['Read and write simple words'] },
      { chapterNumber: 4, chapterName: 'Short Sentences', description: 'Sentence formation', topics: [{ topicName: 'Subject + Verb' }, { topicName: 'Simple sentences' }], learningOutcomes: ['Form basic sentences'] },
      { chapterNumber: 5, chapterName: 'Stories and Poems', description: 'Reading comprehension', topics: [{ topicName: 'Short stories' }, { topicName: 'Rhymes' }], learningOutcomes: ['Understand short stories'] }
    ];
  }

  // Check for Mathematics
  if (subjectName.toLowerCase().includes('math')) {
    return [
      { chapterNumber: 1, chapterName: 'Numbers', description: 'Number recognition and counting', topics: [{ topicName: 'Counting' }, { topicName: 'Writing numbers' }], learningOutcomes: ['Count objects', 'Write numbers'] },
      { chapterNumber: 2, chapterName: 'Shapes and Patterns', description: 'Basic shapes and patterns', topics: [{ topicName: 'Basic shapes' }, { topicName: 'Patterns' }], learningOutcomes: ['Identify shapes', 'Complete patterns'] },
      { chapterNumber: 3, chapterName: 'Addition', description: 'Simple addition', topics: [{ topicName: 'Adding with objects' }, { topicName: 'Number addition' }], learningOutcomes: ['Add numbers'] },
      { chapterNumber: 4, chapterName: 'Subtraction', description: 'Simple subtraction', topics: [{ topicName: 'Taking away' }, { topicName: 'Number subtraction' }], learningOutcomes: ['Subtract numbers'] },
      { chapterNumber: 5, chapterName: 'Problem Solving', description: 'Apply mathematical concepts', topics: [{ topicName: 'Word problems' }, { topicName: 'Logical thinking' }], learningOutcomes: ['Solve problems'] }
    ];
  }

  // Check for Science
  if (subjectName.toLowerCase().includes('science')) {
    return [
      { chapterNumber: 1, chapterName: 'Our Body', description: 'Body parts and functions', topics: [{ topicName: 'Major organs' }, { topicName: 'Senses' }], learningOutcomes: ['Name body parts and their functions'] },
      { chapterNumber: 2, chapterName: 'Plants Around Us', description: 'Introduction to plants', topics: [{ topicName: 'Parts of a plant' }, { topicName: 'Types of plants' }], learningOutcomes: ['Identify parts of a plant'] },
      { chapterNumber: 3, chapterName: 'Animals', description: 'Animal classification', topics: [{ topicName: 'Domestic animals' }, { topicName: 'Wild animals' }], learningOutcomes: ['Classify animals'] },
      { chapterNumber: 4, chapterName: 'Water and Air', description: 'Natural resources', topics: [{ topicName: 'Uses of water' }, { topicName: 'Air around us' }], learningOutcomes: ['Understand natural resources'] },
      { chapterNumber: 5, chapterName: 'Weather and Seasons', description: 'Types of weather', topics: [{ topicName: 'Weather types' }, { topicName: 'Seasons' }], learningOutcomes: ['Identify weather and seasons'] }
    ];
  }

  // Check for Hindi
  if (subjectName.toLowerCase().includes('hindi')) {
    return [
      { chapterNumber: 1, chapterName: 'वर्णमाला (Alphabet)', description: 'Hindi alphabets', topics: [{ topicName: 'स्वर (Vowels)' }, { topicName: 'व्यंजन (Consonants)' }], learningOutcomes: ['Learn Hindi alphabets'] },
      { chapterNumber: 2, chapterName: 'मात्राएं (Matras)', description: 'Vowel marks', topics: [{ topicName: 'Basic matras' }, { topicName: 'Matra practice' }], learningOutcomes: ['Apply matras correctly'] },
      { chapterNumber: 3, chapterName: 'शब्द (Words)', description: 'Simple words', topics: [{ topicName: 'Two-letter words' }, { topicName: 'Three-letter words' }], learningOutcomes: ['Read simple Hindi words'] },
      { chapterNumber: 4, chapterName: 'वाक्य (Sentences)', description: 'Sentence formation', topics: [{ topicName: 'Simple sentences' }], learningOutcomes: ['Form basic sentences'] },
      { chapterNumber: 5, chapterName: 'कहानी (Stories)', description: 'Story reading', topics: [{ topicName: 'Moral stories' }], learningOutcomes: ['Understand simple stories'] }
    ];
  }

  // Check for EVS
  if (subjectName.toLowerCase().includes('evs') || subjectName.toLowerCase().includes('environmental')) {
    return [
      { chapterNumber: 1, chapterName: 'My Family', description: 'Family members', topics: [{ topicName: 'Parents' }, { topicName: 'Siblings' }], learningOutcomes: ['Name family members'] },
      { chapterNumber: 2, chapterName: 'My School', description: 'School environment', topics: [{ topicName: 'Classroom' }, { topicName: 'Playground' }], learningOutcomes: ['Describe school areas'] },
      { chapterNumber: 3, chapterName: 'Good Habits', description: 'Healthy habits', topics: [{ topicName: 'Cleanliness' }, { topicName: 'Hygiene' }], learningOutcomes: ['Practice good habits'] },
      { chapterNumber: 4, chapterName: 'Food We Eat', description: 'Nutrition', topics: [{ topicName: 'Fruits' }, { topicName: 'Vegetables' }], learningOutcomes: ['Identify healthy foods'] },
      { chapterNumber: 5, chapterName: 'Transport', description: 'Modes of transport', topics: [{ topicName: 'Land transport' }, { topicName: 'Water and air transport' }], learningOutcomes: ['Name different vehicles'] }
    ];
  }

  // Check for Social Studies/Science
  if (subjectName.toLowerCase().includes('social')) {
    return [
      { chapterNumber: 1, chapterName: 'Our Country India', description: 'Geography of India', topics: [{ topicName: 'Map of India' }, { topicName: 'States' }], learningOutcomes: ['Locate India on map'] },
      { chapterNumber: 2, chapterName: 'National Symbols', description: 'Indian symbols', topics: [{ topicName: 'National Flag' }, { topicName: 'National Anthem' }], learningOutcomes: ['Identify national symbols'] },
      { chapterNumber: 3, chapterName: 'Great Leaders', description: 'Freedom fighters', topics: [{ topicName: 'Mahatma Gandhi' }, { topicName: 'Jawaharlal Nehru' }], learningOutcomes: ['Know about leaders'] },
      { chapterNumber: 4, chapterName: 'Our Culture', description: 'Indian culture', topics: [{ topicName: 'Festivals' }, { topicName: 'Traditions' }], learningOutcomes: ['Understand Indian culture'] },
      { chapterNumber: 5, chapterName: 'Government', description: 'Introduction to government', topics: [{ topicName: 'Democracy' }, { topicName: 'Rights' }], learningOutcomes: ['Understand basic governance'] }
    ];
  }

  // Check for Computer
  if (subjectName.toLowerCase().includes('computer')) {
    return [
      { chapterNumber: 1, chapterName: 'Introduction to Computer', description: 'Computer basics', topics: [{ topicName: 'Parts of computer' }, { topicName: 'Uses' }], learningOutcomes: ['Identify computer parts'] },
      { chapterNumber: 2, chapterName: 'Input and Output', description: 'Devices', topics: [{ topicName: 'Keyboard, Mouse' }, { topicName: 'Monitor, Printer' }], learningOutcomes: ['Differentiate I/O devices'] },
      { chapterNumber: 3, chapterName: 'MS Paint', description: 'Drawing software', topics: [{ topicName: 'Tools' }, { topicName: 'Drawing' }], learningOutcomes: ['Create simple drawings'] },
      { chapterNumber: 4, chapterName: 'Internet Basics', description: 'Introduction to internet', topics: [{ topicName: 'Web browser' }, { topicName: 'Searching' }], learningOutcomes: ['Browse safely'] },
      { chapterNumber: 5, chapterName: 'Typing Practice', description: 'Keyboard skills', topics: [{ topicName: 'Home row keys' }, { topicName: 'Speed typing' }], learningOutcomes: ['Type basic words'] }
    ];
  }

  // Check for Drawing
  if (subjectName.toLowerCase().includes('drawing') || subjectName.toLowerCase().includes('art')) {
    return [
      { chapterNumber: 1, chapterName: 'Lines and Shapes', description: 'Basic drawing', topics: [{ topicName: 'Straight lines' }, { topicName: 'Curved lines' }], learningOutcomes: ['Draw basic shapes'] },
      { chapterNumber: 2, chapterName: 'Coloring', description: 'Color application', topics: [{ topicName: 'Primary colors' }, { topicName: 'Coloring techniques' }], learningOutcomes: ['Use colors properly'] },
      { chapterNumber: 3, chapterName: 'Nature Drawing', description: 'Drawing natural objects', topics: [{ topicName: 'Trees' }, { topicName: 'Flowers' }], learningOutcomes: ['Draw nature'] },
      { chapterNumber: 4, chapterName: 'Objects', description: 'Drawing daily objects', topics: [{ topicName: 'Fruits' }, { topicName: 'Toys' }], learningOutcomes: ['Draw objects'] },
      { chapterNumber: 5, chapterName: 'Free Hand Drawing', description: 'Creative drawing', topics: [{ topicName: 'Imagination' }], learningOutcomes: ['Express creativity'] }
    ];
  }

  // Check for GK/General Awareness
  if (subjectName.toLowerCase().includes('general') || subjectName.toLowerCase().includes('gk') || subjectName.toLowerCase().includes('awareness')) {
    return [
      { chapterNumber: 1, chapterName: 'Colors', description: 'Identifying colors', topics: [{ topicName: 'Primary colors' }, { topicName: 'Secondary colors' }], learningOutcomes: ['Name all colors'] },
      { chapterNumber: 2, chapterName: 'Animals and Birds', description: 'Animal knowledge', topics: [{ topicName: 'Domestic' }, { topicName: 'Wild' }], learningOutcomes: ['Identify animals'] },
      { chapterNumber: 3, chapterName: 'Festivals', description: 'Indian festivals', topics: [{ topicName: 'Diwali' }, { topicName: 'Holi' }], learningOutcomes: ['Know festival names'] },
      { chapterNumber: 4, chapterName: 'Famous Places', description: 'Monuments', topics: [{ topicName: 'Taj Mahal' }, { topicName: 'Red Fort' }], learningOutcomes: ['Identify monuments'] },
      { chapterNumber: 5, chapterName: 'Sports', description: 'Popular sports', topics: [{ topicName: 'Cricket' }, { topicName: 'Football' }], learningOutcomes: ['Name sports'] }
    ];
  }

  // Check for Rhymes/Stories
  if (subjectName.toLowerCase().includes('rhyme') || subjectName.toLowerCase().includes('stories')) {
    return [
      { chapterNumber: 1, chapterName: 'Twinkle Twinkle', description: 'Popular rhyme', topics: [{ topicName: 'Learning rhyme' }], learningOutcomes: ['Recite the rhyme'] },
      { chapterNumber: 2, chapterName: 'Humpty Dumpty', description: 'Action rhyme', topics: [{ topicName: 'Actions' }], learningOutcomes: ['Perform actions'] },
      { chapterNumber: 3, chapterName: 'Baa Baa Black Sheep', description: 'Animal rhyme', topics: [{ topicName: 'Animal sounds' }], learningOutcomes: ['Sing along'] },
      { chapterNumber: 4, chapterName: 'Jack and Jill', description: 'Story rhyme', topics: [{ topicName: 'Story telling' }], learningOutcomes: ['Narrate story'] },
      { chapterNumber: 5, chapterName: 'Wheels on the Bus', description: 'Action song', topics: [{ topicName: 'Transport' }], learningOutcomes: ['Enjoy singing'] }
    ];
  }

  // Return default chapters for any other subject
  return defaultChapters;
};

const seedSyllabus = async () => {
  try {
    await connectDB();
    console.log('📚 Starting syllabus seeding...\n');

    // Find or create an admin user for createdBy field
    let adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('⚠️  No admin user found. Creating default admin...');
      adminUser = await User.create({
        username: 'admin',
        email: 'admin@school.com',
        password: 'admin123',
        role: 'admin',
        isActive: true
      });
      console.log('✅ Default admin user created\n');
    }

    console.log(`Using admin user: ${adminUser.username} (ID: ${adminUser._id})\n`);

    // Delete existing syllabus
    await Syllabus.deleteMany({});
    console.log('✅ Cleared existing syllabus data\n');

    let totalCreated = 0;

    // Loop through each class and section
    for (const className of CLASSES) {
      for (const section of SECTIONS) {
        console.log(`📖 Creating syllabus for ${className} - Section ${section}...`);

        // Get all subjects for this class
        const subjects = await Subject.find({ 
          className, 
          academicYear: ACADEMIC_YEAR,
          isActive: true 
        });

        if (subjects.length === 0) {
          console.log(`   ⚠️  No subjects found for ${className}. Run seedSubjects.js first!`);
          continue;
        }

        // Create syllabus for each subject
        for (const subject of subjects) {
          const subjectName = subject.subjectName;
          
          // Get chapters template for this subject based on name pattern
          const chapters = getChaptersForSubject(subjectName);

          // Set random statuses for demonstration
          const chaptersWithStatus = chapters.map(ch => ({
            ...ch,
            status: Math.random() > 0.7 ? 'completed' : Math.random() > 0.4 ? 'ongoing' : 'pending',
            startDate: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : undefined,
            completedDate: Math.random() > 0.8 ? new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000) : undefined,
            teacherNotes: `Remember to focus on practical examples for ${className} students.`
          }));

          const syllabusData = {
            className,
            section,
            subjectId: subject._id,
            academicYear: ACADEMIC_YEAR,
            term: 'Annual',
            chapters: chaptersWithStatus,
            isPublished: true,
            createdBy: adminUser._id,
            lastModifiedBy: adminUser._id
          };

          await Syllabus.create(syllabusData);
          totalCreated++;
          console.log(`   ✓ ${subjectName}`);
        }
      }
      console.log('');
    }

    console.log(`\n🎉 Successfully created ${totalCreated} syllabus records!`);
    console.log(`\n📊 Summary:`);
    console.log(`   Classes: ${CLASSES.length}`);
    console.log(`   Sections per class: ${SECTIONS.length}`);
    console.log(`   Total syllabus: ${totalCreated}`);
    console.log(`\n✅ Seeding completed successfully!`);

  } catch (error) {
    console.error('❌ Error seeding syllabus:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedSyllabus();
