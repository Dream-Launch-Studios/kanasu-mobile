import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define media types we'll handle
type MediaType = 'image' | 'audio';

interface MediaFile {
  questionId: string;
  url: string;
  type: MediaType;
  localUri?: string;
}

interface MediaMap {
  [questionId: string]: {
    imageUrl?: string;
    audioUrl?: string;
  };
}

// Create base directory for media storage
const MEDIA_BASE_DIR = `${FileSystem.documentDirectory}assessment_media/`;

// Ensure base directory exists
const ensureDirectoryExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(MEDIA_BASE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_BASE_DIR, { intermediates: true });
  }
};

// Download a single media file
const downloadMediaFile = async (mediaFile: MediaFile, assessmentId: string): Promise<string> => {
  try {
    await ensureDirectoryExists();
    
    // Create a unique filename
    const extension = mediaFile.url.split('.').pop() || (mediaFile.type === 'image' ? 'jpg' : 'mp3');
    const filename = `${assessmentId}_${mediaFile.questionId}_${mediaFile.type}.${extension}`;
    const localUri = `${MEDIA_BASE_DIR}${filename}`;

    // Check if file already exists
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      return localUri;
    }

    // Download the file
    const downloadResult = await FileSystem.downloadAsync(mediaFile.url, localUri);
    if (downloadResult.status !== 200) {
      throw new Error(`Failed to download ${mediaFile.type} for question ${mediaFile.questionId}`);
    }

    return localUri;
  } catch (error) {
    console.error(`Error downloading ${mediaFile.type}:`, error);
    throw error;
  }
};

// Download all media files for an assessment
export const downloadAssessmentMedia = async (
  assessmentId: string,
  mediaFiles: MediaFile[]
): Promise<MediaMap> => {
  try {
    const mediaMap: MediaMap = {};
    
    // Download each file and store its local URI
    await Promise.all(
      mediaFiles.map(async (mediaFile) => {
        try {
          const localUri = await downloadMediaFile(mediaFile, assessmentId);
          
          // Initialize the question entry if it doesn't exist
          if (!mediaMap[mediaFile.questionId]) {
            mediaMap[mediaFile.questionId] = {};
          }
          
          // Store the local URI based on media type
          if (mediaFile.type === 'image') {
            mediaMap[mediaFile.questionId].imageUrl = localUri;
          } else {
            mediaMap[mediaFile.questionId].audioUrl = localUri;
          }
        } catch (error) {
          console.error(`Failed to download media for question ${mediaFile.questionId}:`, error);
        }
      })
    );

    // Store the media map for future use
    await AsyncStorage.setItem(
      `assessment_media_${assessmentId}`,
      JSON.stringify(mediaMap)
    );

    return mediaMap;
  } catch (error) {
    console.error('Error in downloadAssessmentMedia:', error);
    throw error;
  }
};

// Get local media URIs for a question
export const getQuestionMedia = async (
  assessmentId: string,
  questionId: string
): Promise<{ imageUrl?: string; audioUrl?: string }> => {
  try {
    const mediaMapString = await AsyncStorage.getItem(`assessment_media_${assessmentId}`);
    if (!mediaMapString) {
      return {};
    }

    const mediaMap: MediaMap = JSON.parse(mediaMapString);
    return mediaMap[questionId] || {};
  } catch (error) {
    console.error('Error getting question media:', error);
    return {};
  }
};

// Clean up media files for an assessment
export const cleanupAssessmentMedia = async (assessmentId: string) => {
  try {
    const mediaMapString = await AsyncStorage.getItem(`assessment_media_${assessmentId}`);
    if (mediaMapString) {
      // Remove the media map from AsyncStorage
      await AsyncStorage.removeItem(`assessment_media_${assessmentId}`);
      
      // Delete the media directory for this assessment
      await FileSystem.deleteAsync(MEDIA_BASE_DIR, { idempotent: true });
    }
  } catch (error) {
    console.error('Error cleaning up media:', error);
  }
}; 