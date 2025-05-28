import AsyncStorage from '@react-native-async-storage/async-storage';

export const getTranslatedText = (english: string, kannada: string): string => {
  // Get the bilingual mode from AsyncStorage synchronously
  let isBilingual = true;
  try {
    const storedMode = AsyncStorage.getItem('bilingualMode');
    isBilingual = storedMode !== 'false';
  } catch (error) {
    console.error('Error reading bilingual mode:', error);
  }

  return isBilingual ? `${english} | ${kannada}` : english;
};

// Helper function to check if bilingual mode is enabled
export const isBilingualEnabled = async (): Promise<boolean> => {
  try {
    const storedMode = await AsyncStorage.getItem('bilingualMode');
    return storedMode !== 'false';
  } catch (error) {
    console.error('Error reading bilingual mode:', error);
    return true; // Default to true if there's an error
  }
}; 