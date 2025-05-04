import AsyncStorage from "@react-native-async-storage/async-storage";

export const clearAllStorage = async () => {
  try {
    await AsyncStorage.clear();
    console.log("All AsyncStorage items cleared successfully");
  } catch (error) {
    console.error("Error clearing AsyncStorage:", error);
  }
};
