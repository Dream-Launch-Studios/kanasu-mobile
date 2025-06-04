import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Platform,
  Modal,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/Colors";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/constants/api";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { getQuestionMedia } from "../utils/mediaStorage";

const { width, height } = Dimensions.get("window");

interface Question {
  id: string;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  answerOptions?: string[];
}

interface Topic {
  id: string;
  name: string;
  description: string;
  questions: Question[];
}

interface Assessment {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: string;
  topics: Topic[];
}

interface Student {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
  status: "ACTIVE" | "INACTIVE";
}

interface QuestionTimestamp {
  questionId: string;
  startTime: number; // milliseconds from start of recording
  endTime: number; // milliseconds from start of recording
}

// Add new interface for offline storage
interface OfflineSubmission {
  id: string;
  studentId: string;
  assessmentId: string;
  audioUri: string;
  metadata: any;
  timestamps: QuestionTimestamp[];
  recordedAt: string;
  status: "pending" | "synced";
}

interface QuestionMedia {
  imageUrl?: string;
  audioUrl?: string;
}

// Add new interface for pending uploads
interface PendingUpload {
  id: string;
  studentId: string;
  studentName: string;
  assessmentId: string;
  assessmentName: string;
  audioUri: string;
  metadata: any;
  timestamps: QuestionTimestamp[];
  recordedAt: string;
  status: "pending" | "synced";
}

const TakeAssessment = () => {
  const params = useLocalSearchParams();
  const assessmentId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Continuous recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [questionTimestamps, setQuestionTimestamps] = useState<
    QuestionTimestamp[]
  >([]);

  // Countdown state
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);

  const [questionCompleted, setQuestionCompleted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bottom sheet state
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);

  // Add new state for offline mode
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const [currentQuestionMedia, setCurrentQuestionMedia] =
    useState<QuestionMedia>({});

  // Initialize with assessment data and students
  useEffect(() => {
    loadAssessmentAndStudents();
  }, [assessmentId]);

  // Flatten all questions from topics when assessment loads
  useEffect(() => {
    if (assessment) {
      console.log(
        "[Debug] Assessment loaded, processing topics:",
        assessment.topics
      );
      const questions: Question[] = [];
      assessment.topics.forEach((topic) => {
        console.log(`[Debug] Processing topic "${topic.name}":`);
        if (topic.questions) {
          topic.questions.forEach((q, i) => {
            console.log(`[Debug] Question ${i + 1} in topic "${topic.name}":`, {
              id: q.id,
              text: q.text,
              hasText: Boolean(q.text),
              textLength: q.text?.length,
            });
          });
          questions.push(...topic.questions);
        }
      });

      console.log(
        "[Debug] Final processed questions:",
        questions.map((q) => ({
          id: q.id,
          text: q.text,
          hasText: Boolean(q.text),
          textLength: q.text?.length,
        }))
      );

      setAllQuestions(questions);
      if (questions.length > 0) {
        console.log("[Debug] Setting initial question:", {
          id: questions[0].id,
          text: questions[0].text,
          hasText: Boolean(questions[0].text),
          textLength: questions[0].text?.length,
        });
        setCurrentQuestion(questions[0]);
      }
    }
  }, [assessment]);

  // Update current question when index changes
  useEffect(() => {
    if (allQuestions.length > 0 && currentQuestionIndex < allQuestions.length) {
      const newQuestion = allQuestions[currentQuestionIndex];
      console.log("[Debug] Updating current question:", {
        index: currentQuestionIndex,
        id: newQuestion.id,
        text: newQuestion.text,
        hasText: Boolean(newQuestion.text),
        textLength: newQuestion.text?.length,
      });

      setCurrentQuestion(newQuestion);
      setQuestionCompleted(false);

      // Load offline media for the current question
      if (isOfflineMode && assessmentId) {
        getQuestionMedia(assessmentId, newQuestion.id)
          .then((media: QuestionMedia) => {
            console.log("Loaded offline media:", media);
            setCurrentQuestionMedia(media);
          })
          .catch((error: Error) => {
            console.error("Error loading offline media:", error);
          });
      }
    }
  }, [currentQuestionIndex, allQuestions, isOfflineMode, assessmentId]);

  // Load assessment data and students
  const loadAssessmentAndStudents = async () => {
    try {
      setLoading(true);
      const anganwadiId = await AsyncStorage.getItem("anganwadiId");

      console.log("[Debug] Starting loadAssessmentAndStudents");
      console.log("[Debug] AnganwadiId:", anganwadiId);

      if (!assessmentId || !anganwadiId) {
        setError("Missing required data");
        setLoading(false);
        return;
      }

      // Check for offline data
      const offlineData = await AsyncStorage.getItem(
        `assessment_${assessmentId}`
      );
      if (offlineData) {
        try {
          console.log(
            "[Debug] Found offline data for assessment:",
            assessmentId
          );
          const parsedData = JSON.parse(offlineData);
          console.log(
            "[Debug] Raw offline data:",
            JSON.stringify(parsedData, null, 2)
          );
          console.log(
            "[Debug] Parsed offline data assessment:",
            parsedData.assessment
          );
          console.log(
            "[Debug] Parsed offline data topics:",
            JSON.stringify(parsedData.topics, null, 2)
          );

          // Verify the structure of topics and questions
          if (parsedData.topics) {
            parsedData.topics.forEach((topic: any, index: number) => {
              console.log(`[Debug] Topic ${index + 1}:`, {
                name: topic.name,
                questionCount: topic.questions?.length || 0,
                firstQuestion: topic.questions?.[0],
              });
            });
          }

          setAssessment({
            id: parsedData.assessment.id,
            name: parsedData.assessment.name,
            description: parsedData.assessment.description,
            startDate: parsedData.assessment.startDate,
            endDate: parsedData.assessment.endDate,
            isActive: parsedData.assessment.isActive,
            status: parsedData.assessment.status,
            topics: parsedData.topics,
          });

          if (parsedData.students && Array.isArray(parsedData.students)) {
            // Filter out students who have already been assessed
            const offlineSubmissions = await AsyncStorage.getItem(
              `offline_submissions_${assessmentId}`
            );
            const submissions = offlineSubmissions
              ? JSON.parse(offlineSubmissions)
              : [];
            const assessedStudentIds = new Set(
              submissions.map((sub: OfflineSubmission) => sub.studentId)
            );

            const availableStudents = parsedData.students.filter(
              (student: any) => !assessedStudentIds.has(student.id)
            );

            setStudents(availableStudents);
          }

          setIsOfflineMode(true);
          setError(null);
          setLoading(false);
          return;
        } catch (parseError) {
          console.error("Error parsing offline data:", parseError);
        }
      }

      // If no offline data or parsing failed, try online mode
      const authToken = await AsyncStorage.getItem("authToken");
      if (!authToken) {
        setError("Please download the assessment for offline use");
        setLoading(false);
        return;
      }

      // ... rest of the online loading code ...
    } catch (e) {
      console.error("Error loading data:", e);
      setError("Failed to load assessment data");
    } finally {
      setLoading(false);
    }
  };

  // Select a student to assess
  const selectStudent = (student: Student) => {
    setCurrentStudent(student);
    setCurrentQuestionIndex(0);
    setQuestionTimestamps([]);
    setQuestionCompleted(false);

    // Start countdown before recording
    startCountdown();
  };

  // Start countdown, then start recording
  const startCountdown = () => {
    setIsCountingDown(true);
    setCountdownValue(3);

    const countdownInterval = setInterval(() => {
      setCountdownValue((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setIsCountingDown(false);
          // Start recording after countdown
          startFullRecording();
          return 3; // Reset for next time
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Start recording for the entire assessment
  const startFullRecording = async () => {
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please allow microphone access to record responses"
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await newRecording.startAsync();

      // Save recording and start time
      setRecording(newRecording);
      setIsRecording(true);
      const startTime = Date.now();
      setRecordingStartTime(startTime);

      console.log("Recording started at:", new Date(startTime).toISOString());
    } catch (error) {
      console.error("Failed to start recording", error);
      Alert.alert("Recording Error", "Failed to start recording");
    }
  };

  // Mark start time for current question
  const markQuestionStart = () => {
    if (!currentQuestion) return;

    // Calculate time from recording start
    const relativeTime = Date.now() - recordingStartTime;

    console.log(`Starting question ${currentQuestion.id} at ${relativeTime}ms`);

    // Add to timestamps array
    setQuestionTimestamps((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        startTime: relativeTime,
        endTime: 0, // Will set this when question ends
      },
    ]);
  };

  // Mark end time for current question
  const markQuestionEnd = () => {
    if (!currentQuestion) return;

    // Calculate time from recording start
    const relativeTime = Date.now() - recordingStartTime;

    console.log(`Ending question ${currentQuestion.id} at ${relativeTime}ms`);

    // Update existing timestamp
    setQuestionTimestamps((prev) =>
      prev.map((item) =>
        item.questionId === currentQuestion.id
          ? { ...item, endTime: relativeTime }
          : item
      )
    );

    setQuestionCompleted(true);
  };

  // Stop the full recording and process it
  const stopFullRecording = async () => {
    if (!recording) {
      console.error("No active recording found");
      return;
    }

    try {
      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri || null);
      setIsRecording(false);

      console.log("Recording stopped, URI:", uri);

      return uri;
    } catch (error) {
      console.error("Failed to stop recording", error);
      Alert.alert("Recording Error", "Failed to stop recording");
      return null;
    }
  };

  // Upload audio file to server
  const uploadAudio = async (uri: string) => {
    try {
      console.log("Uploading audio file:", uri);

      const authToken = await AsyncStorage.getItem("authToken");
      if (!authToken) {
        throw new Error("Authentication token not found");
      }

      // Create form data for file upload with correct field name
      const formData = new FormData();

      // The backend is expecting "file" field, not "audio"
      formData.append("file", {
        uri: uri,
        type: "audio/mp3",
        name: `recording_${Date.now()}.acc`,
      } as any);

      console.log("Sending request to upload endpoint with file field...");

      // Additional logging to diagnose issues
      console.log(
        "FormData contents:",
        JSON.stringify({
          fieldName: "file",
          uri: uri.substring(0, 50) + "...", // Show part of the URI for debugging
          type: "audio/mp3",
          name: `recording_${Date.now()}.acc`,
        })
      );

      // Change to a working endpoint (questions/upload-audio)
      const uploadEndpoint = `${API_URL}/questions/upload-audio`;
      console.log("Using upload endpoint:", uploadEndpoint);

      // Upload to server
      const response = await axios.post(uploadEndpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${authToken}`,
        },
        // Add longer timeout for large files
        timeout: 30000, // 30 seconds
      });

      console.log("Audio upload response:", response.data);

      // Handle different possible response formats
      if (response.data) {
        // Different backends might use different field names
        const url =
          response.data.audioUrl ||
          response.data.secure_url ||
          response.data.fileUrl;
        if (url) {
          console.log("Successfully got audio URL:", url);
          return url;
        }
      }

      throw new Error("Invalid response from server: missing audioUrl");
    } catch (error: any) {
      console.error("Failed to upload audio:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", JSON.stringify(error.response.data));
      }
      throw error;
    }
  };

  // Create metadata JSON for the audio recording
  const createAudioMetadata = () => {
    if (!currentStudent || !assessment) {
      return null;
    }

    // Format timestamps as mm:ss format for better readability
    const formatTime = (milliseconds: number) => {
      const totalSeconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    };

    // Create response segments with formatted timestamps and question info
    const segments = questionTimestamps.map((timestamp, index) => {
      // Find the question text using the ID
      const question = allQuestions.find((q) => q.id === timestamp.questionId);

      // Find which topic this question belongs to for better context
      let topicName = "Unknown Topic";
      if (assessment && assessment.topics) {
        for (const topic of assessment.topics) {
          if (
            topic.questions &&
            topic.questions.some((q) => q.id === timestamp.questionId)
          ) {
            topicName = topic.name;
            break;
          }
        }
      }

      return {
        index: index + 1,
        questionId: timestamp.questionId,
        questionText: question?.text || "Unknown question",
        topicName: topicName,
        questionType: question?.answerOptions ? "SPEAKING" : "TEXT",
        startTimeMs: timestamp.startTime,
        endTimeMs: timestamp.endTime,
        durationMs: timestamp.endTime - timestamp.startTime,
        startTimeFormatted: formatTime(timestamp.startTime),
        endTimeFormatted: formatTime(timestamp.endTime),
        durationFormatted: formatTime(timestamp.endTime - timestamp.startTime),
      };
    });

    // Add a formatted timestamp for the recording date
    const recordedDate = new Date();
    const formattedDate = recordedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Create the metadata object with optional audioUrl field
    return {
      recordingId: `${currentStudent.id}_${Date.now()}`,
      studentId: currentStudent.id,
      studentName: currentStudent.name,
      assessmentId: assessment.id,
      assessmentName: assessment.name,
      totalDurationMs:
        questionTimestamps.length > 0
          ? Math.max(...questionTimestamps.map((t) => t.endTime))
          : 0,
      totalDurationFormatted: formatTime(
        questionTimestamps.length > 0
          ? Math.max(...questionTimestamps.map((t) => t.endTime))
          : 0
      ),
      recordedAt: recordedDate.toISOString(),
      recordedAtFormatted: formattedDate,
      segments: segments,
      totalSegments: segments.length,
      audioUrl: "", // Initialize with empty string, will be updated later
    };
  };

  // Upload metadata JSON to server
  const uploadMetadata = async (metadata: any) => {
    try {
      console.log("Preparing to upload metadata to server");

      const authToken = await AsyncStorage.getItem("authToken");
      if (!authToken) {
        throw new Error("Authentication token not found");
      }

      // Make a deep copy to avoid modifying the original object
      const metadataCopy = JSON.parse(JSON.stringify(metadata));

      // Ensure metadata has all required fields
      if (
        !metadataCopy.recordingId ||
        !metadataCopy.studentId ||
        !metadataCopy.segments
      ) {
        console.error("Metadata missing required fields");
        return null;
      }

      console.log(
        `Uploading metadata with ${metadataCopy.segments.length} segments`
      );

      // First attempt - try regular upload endpoint
      try {
        const response = await axios.post(
          `${API_URL}/student-responses/upload-metadata`,
          { metadata: metadataCopy },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            timeout: 10000, // 10 second timeout
          }
        );

        console.log("Metadata upload successful:", response.status);
        console.log(
          "Metadata upload response data:",
          JSON.stringify(response.data, null, 2)
        );

        if (response.data && response.data.metadataUrl) {
          return response.data.metadataUrl;
        }

        console.warn("No metadata URL in response:", response.data);
      } catch (error: any) {
        console.error("Primary metadata upload failed:", error.message);
        // Continue to fallback method
      }

      // Fallback approach - try backup endpoint if available
      try {
        console.log("Attempting fallback metadata upload");
        const fallbackResponse = await axios.post(
          `${API_URL}/student-responses/upload-metadata`,
          { metadata: metadataCopy },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            timeout: 10000,
          }
        );

        if (fallbackResponse.data && fallbackResponse.data.metadataUrl) {
          console.log("Fallback metadata upload successful");
          return fallbackResponse.data.metadataUrl;
        }
      } catch (secondaryError: any) {
        console.error(
          "Fallback metadata upload also failed:",
          secondaryError.message
        );
      }

      // Store metadata locally if all upload attempts fail
      try {
        const metadataKey = `metadata_${metadata.recordingId}`;
        await AsyncStorage.setItem(metadataKey, JSON.stringify(metadataCopy));
        console.log("Metadata saved locally for later upload");
      } catch (storageError) {
        console.error("Failed to save metadata locally:", storageError);
      }

      return null; // Continue with the process even if metadata upload fails
    } catch (error: any) {
      console.error("Metadata upload error:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", JSON.stringify(error.response.data));
      }
      return null;
    }
  };

  // Show bottom sheet instead of alert
  const handleSubmitPress = () => {
    setShowSubmitConfirmation(true);
  };

  // Handle confirmation from bottom sheet
  const handleSubmitConfirm = async () => {
    setShowSubmitConfirmation(false);
    // Call the actual submit function
    await submitResponses();
  };

  // Handle cancellation from bottom sheet
  const handleSubmitCancel = () => {
    setShowSubmitConfirmation(false);
  };

  // Add function to store pending upload
  const storePendingUpload = async (uploadData: PendingUpload) => {
    try {
      // Get existing pending uploads
      const pendingUploadsStr = await AsyncStorage.getItem("pendingUploads");
      const pendingUploads: PendingUpload[] = pendingUploadsStr
        ? JSON.parse(pendingUploadsStr)
        : [];

      // Add new upload
      pendingUploads.push(uploadData);

      // Save back to storage
      await AsyncStorage.setItem(
        "pendingUploads",
        JSON.stringify(pendingUploads)
      );

      console.log("Stored pending upload:", uploadData.id);
    } catch (error) {
      console.error("Error storing pending upload:", error);
      throw error;
    }
  };

  // Modify submitResponses to use the new storage system
  const submitResponses = async () => {
    if (!currentStudent || !assessment) {
      Alert.alert("Error", "Missing student or assessment data");
      return;
    }

    try {
      setIsSubmitting(true);

      // Stop recording
      const audioFileUri = await stopFullRecording();

      if (!audioFileUri) {
        setIsSubmitting(false);
        Alert.alert("Error", "Failed to get recording file");
        return;
      }

      // Create metadata
      const metadata = createAudioMetadata();

      // Create pending upload object
      const pendingUpload: PendingUpload = {
        id: `${Date.now()}_${currentStudent.id}`,
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        assessmentId: assessment.id,
        assessmentName: assessment.name,
        audioUri: audioFileUri,
        metadata,
        timestamps: questionTimestamps,
        recordedAt: new Date().toISOString(),
        status: "pending",
      };

      // Store the pending upload
      await storePendingUpload(pendingUpload);

      // If we're in offline mode, also store in offline submissions
      if (isOfflineMode) {
        const existingSubmissionsStr = await AsyncStorage.getItem(
          `offline_submissions_${assessment.id}`
        );
        const existingSubmissions = existingSubmissionsStr
          ? JSON.parse(existingSubmissionsStr)
          : [];
        existingSubmissions.push(pendingUpload);

        await AsyncStorage.setItem(
          `offline_submissions_${assessment.id}`,
          JSON.stringify(existingSubmissions)
        );
      }

      // Reset state for next student
      setCurrentQuestionIndex(0);
      setQuestionTimestamps([]);
      setQuestionCompleted(false);
      setIsCompleted(false);
      setIsSubmitting(false);
      setAudioUri(null);
      setRecording(null);
      setIsRecording(false);

      // Remove assessed student from the list
      setStudents((prev) => prev.filter((s) => s.id !== currentStudent.id));

      // Find next student
      const currentIndex = students.findIndex(
        (s) => s.id === currentStudent.id
      );
      const nextStudent = students[currentIndex + 1];

      if (nextStudent) {
        selectStudent(nextStudent);
      } else {
        Alert.alert(
          "Assessment Complete",
          isOfflineMode
            ? "All students have been assessed. The responses will be uploaded when you're back online. You can view them in Pending Uploads."
            : "All students have been assessed. You can view the responses in Pending Uploads.",
          [
            {
              text: "View Pending Uploads",
              onPress: () => router.push("/Screens/pendingUploads"),
            },
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Process error:", error);
      setIsSubmitting(false);
      Alert.alert("Error", "Failed to save response");
    }
  };

  // Move to next question
  const goToNextQuestion = () => {
    // Ensure current question has timestamps
    if (!questionCompleted) {
      Alert.alert(
        "Incomplete Recording",
        "Please record the student's response before proceeding"
      );
      return;
    }

    // Check if we've reached the end
    if (currentQuestionIndex >= allQuestions.length - 1) {
      setIsCompleted(true);
      return;
    }

    // Move to next question
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  // Move to previous question
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // Skip current student and move to next
  const skipStudent = () => {
    if (!currentStudent || !students) return;

    const currentIndex = students.findIndex((s) => s.id === currentStudent.id);
    const nextStudent = students[currentIndex + 1];

    if (recording) {
      recording.stopAndUnloadAsync().catch(console.error);
    }

    setCurrentQuestionIndex(0);
    setQuestionTimestamps([]);
    setQuestionCompleted(false);
    setIsCompleted(false);
    setAudioUri(null);
    setRecording(null);
    setIsRecording(false);

    if (nextStudent) {
      selectStudent(nextStudent);
    } else {
      Alert.alert(
        "Assessment Complete",
        "All students have been assessed. You can now go back.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    }
  };

  // Update playQuestionAudio function to handle only manual playback
  const playQuestionAudio = async () => {
    const audioUrl = isOfflineMode
      ? currentQuestionMedia.audioUrl
      : currentQuestion?.audioUrl;

    if (!audioUrl) {
      console.log("No audio URL available for this question");
      return;
    }

    try {
      // Clean up any existing sound first
      if (sound) {
        try {
          await sound.stopAsync().catch(() => {});
          await sound.unloadAsync().catch(() => {});
          setSound(null);
        } catch (error) {
          console.error("Error cleaning up previous sound:", error);
        }
      }

      setIsAudioPlaying(true);

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        {
          shouldPlay: false,
          volume: 1.0,
          progressUpdateIntervalMillis: 100,
          positionMillis: 0,
        }
      );

      setSound(newSound);

      // Set up event listener before playing
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          setIsAudioPlaying(false);
          return;
        }

        if (status.didJustFinish) {
          console.log("Audio playback finished");
          setIsAudioPlaying(false);
        }
      });

      // Set volume and play
      await newSound.setVolumeAsync(1.0);
      await newSound.playAsync();
    } catch (error) {
      console.error("Error in playQuestionAudio:", error);
      setIsAudioPlaying(false);
      Alert.alert("Error", "Failed to play audio");
    }
  };

  // Update useEffect for cleanup only
  useEffect(() => {
    const cleanup = async () => {
      try {
        if (sound) {
          await sound.stopAsync().catch(() => {});
          await sound.unloadAsync().catch(() => {});
          setSound(null);
          setIsAudioPlaying(false);
        }
      } catch (error) {
        console.error("Error in cleanup:", error);
      }
    };

    return () => {
      cleanup();
    };
  }, [currentQuestionIndex]);

  // Add cleanup effect for component unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.stopAsync().catch(() => {});
        sound.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // Check if current question already has timestamps
  const currentQuestionHasTimestamps = questionTimestamps.some(
    (ts) => ts.questionId === currentQuestion?.id
  );

  const currentTimestamp = currentQuestion
    ? questionTimestamps.find((ts) => ts.questionId === currentQuestion.id)
    : null;

  const isQuestionInProgress = Boolean(
    currentTimestamp && currentTimestamp.endTime === 0
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading assessment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render countdown overlay if counting down
  if (isCountingDown && currentStudent) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
        />
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownTitle}>Recording starts in</Text>
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownNumber}>{countdownValue}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Show student selection if no student is selected
  if (!currentStudent) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Select Student</Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.studentListContainer}>
            {students.map((student) => (
              <TouchableOpacity
                key={student.id}
                style={styles.studentCard}
                onPress={() => selectStudent(student)}
              >
                <View style={styles.studentInitialContainer}>
                  <Text style={styles.studentInitial}>
                    {student.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentGender}>
                    {student.gender === "MALE" ? "Boy" : "Girl"} •{" "}
                    {student.status === "ACTIVE" ? "Active" : "Inactive"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {students.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No students available</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (isRecording) {
                Alert.alert(
                  "Assessment in Progress",
                  "Please finish the assessment before going back"
                );
                return;
              }

              // Confirm if user wants to abandon assessment
              Alert.alert(
                "Cancel Assessment",
                "Are you sure you want to cancel this assessment? All recordings will be lost.",
                [
                  { text: "No", style: "cancel" },
                  {
                    text: "Yes",
                    style: "destructive",
                    onPress: () => {
                      if (recording) {
                        recording.stopAndUnloadAsync().catch(console.error);
                      }
                      setCurrentStudent(null);
                      router.back();
                    },
                  },
                ]
              );
            }}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{assessment?.name}</Text>
          {isOfflineMode && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeText}>Offline Mode</Text>
            </View>
          )}
        </View>

        <View style={styles.studentBadge}>
          <Text style={styles.studentBadgeText}>
            Student: {currentStudent.name}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {allQuestions.length}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    ((currentQuestionIndex + 1) / allQuestions.length) * 100
                  }%`,
                },
              ]}
            />
          </View>
        </View>

        {currentQuestion && (
          <View style={styles.questionContainer}>
            <View style={styles.questionHeader}>
              <View style={styles.questionTextContainer}>
                <Text style={styles.questionText}>{currentQuestion.text}</Text>
                {currentQuestion.audioUrl && (
                  <TouchableOpacity
                    style={[
                      styles.audioIconButton,
                      isAudioPlaying && styles.audioIconButtonPlaying,
                    ]}
                    onPress={playQuestionAudio}
                    disabled={isAudioPlaying}
                  >
                    <Ionicons
                      name={isAudioPlaying ? "volume-high" : "volume-medium"}
                      size={24}
                      color={
                        isAudioPlaying ? Colors.primary : Colors.textSecondary
                      }
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {(isOfflineMode
              ? currentQuestionMedia.imageUrl
              : currentQuestion.imageUrl) && (
              <View>
                <Image
                  source={{
                    uri: isOfflineMode
                      ? currentQuestionMedia.imageUrl
                      : currentQuestion.imageUrl,
                  }}
                  style={{ width: "100%", height: 200 }}
                  resizeMode="contain"
                />
              </View>
            )}
            <View style={styles.recordingContainer}>
              {!isQuestionInProgress && !questionCompleted && (
                <TouchableOpacity
                  style={styles.recordButton}
                  onPress={markQuestionStart}
                >
                  <Text style={styles.recordButtonText}>
                    Start Question | ಪ್ರಶ್ನೆ ಪ್ರಾರಂಭಿಸಿ
                  </Text>
                </TouchableOpacity>
              )}

              {isQuestionInProgress && (
                <View style={styles.recordingActiveContainer}>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Recording...</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={markQuestionEnd}
                  >
                    <Text style={styles.stopButtonText}>
                      End Question | ಪ್ರಶ್ನೆ ಮುಗಿಸಿ
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {questionCompleted && (
                <View style={styles.recordingCompleteContainer}>
                  <Text style={styles.recordingCompleteText}>
                    Question Complete
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.navigationContainer}>
          {isCompleted ? (
            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting ? styles.disabledButton : {},
              ]}
              onPress={handleSubmitPress}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Finish & Submit | ಮುಗಿಸಿ & ಸಲ್ಲಿಸಿ
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.navButtonsContainer}>
              <TouchableOpacity style={styles.skipButton} onPress={skipStudent}>
                <Text style={styles.skipButtonText}>Skip | ಸ್ಕಿಪ್</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.navButton,
                  !questionCompleted ? styles.disabledButton : {},
                ]}
                onPress={goToNextQuestion}
                disabled={!questionCompleted || isQuestionInProgress}
              >
                <Text style={styles.navButtonText}>Next | ಮುಂದೆ</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Bottom Sheet Confirmation */}
      <Modal
        visible={showSubmitConfirmation}
        transparent={true}
        animationType="slide"
        onRequestClose={handleSubmitCancel}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleSubmitCancel}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>
              Are you sure you want to submit the response?
            </Text>
            <Text style={styles.bottomSheetSubtext}>
              Once submitted, you move onto next student.
            </Text>
            <View style={styles.bottomSheetButtons}>
              <TouchableOpacity
                style={styles.bottomSheetCancelButton}
                onPress={handleSubmitCancel}
              >
                <Text style={styles.bottomSheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bottomSheetConfirmButton}
                onPress={handleSubmitConfirm}
              >
                <Text style={styles.bottomSheetConfirmText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default TakeAssessment;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: height * 0.02,
    paddingHorizontal: width * 0.05,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.primary,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  errorContainer: {
    margin: 15,
    padding: 15,
    backgroundColor: Colors.error + "10",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error + "30",
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: "center",
  },
  studentListContainer: {
    padding: width * 0.05,
  },
  studentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  studentInitialContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent + "20",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  studentInitial: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.accent,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  studentGender: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  studentBadge: {
    backgroundColor: Colors.primary + "15",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: width * 0.05,
    marginTop: 15,
    marginBottom: 10,
  },
  studentBadgeText: {
    color: Colors.primary,
    fontWeight: "600",
    fontSize: 15,
  },
  progressContainer: {
    paddingHorizontal: width * 0.05,
    marginTop: 15,
    marginBottom: 10,
  },
  progressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
  },
  questionContainer: {
    flex: 1,
    padding: width * 0.05,
    marginTop: 10,
  },
  questionHeader: {
    marginBottom: 25,
  },
  questionTextContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  questionText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
    lineHeight: 28,
    marginRight: 10,
  },
  audioIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  audioIconButtonPlaying: {
    backgroundColor: Colors.primary + "10",
    borderColor: Colors.primary,
  },
  recordingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  recordButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
    minWidth: width * 0.7,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  recordButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  recordingActiveContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.success + "15",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 25,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    marginRight: 8,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  recordingText: {
    fontSize: 16,
    color: Colors.success,
    fontWeight: "600",
  },
  stopButton: {
    backgroundColor: Colors.success,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 16,
    minWidth: width * 0.7,
    alignItems: "center",
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  recordingCompleteContainer: {
    alignItems: "center",
    backgroundColor: Colors.success + "15",
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 20,
  },
  recordingCompleteText: {
    fontSize: 16,
    color: Colors.success,
    fontWeight: "600",
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: width * 0.05,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  navButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 12,
  },
  navButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flex: 1,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  navButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  skipButton: {
    backgroundColor: Colors.warning,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flex: 1,
    alignItems: "center",
    shadowColor: Colors.warning,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  skipButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 25,
    paddingVertical: 15,
    width: "100%",
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  countdownOverlay: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  countdownTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 50,
  },
  countdownCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  countdownNumber: {
    fontSize: 100,
    fontWeight: "bold",
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  bottomSheetSubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 25,
  },
  bottomSheetButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  bottomSheetCancelButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bottomSheetCancelText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
  bottomSheetConfirmButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomSheetConfirmText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  offlineBadge: {
    backgroundColor: Colors.warning + "20",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 10,
  },
  offlineBadgeText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: "600",
  },
});
