import axios from 'axios';
import { Audio } from 'expo-av'; // Use expo-av instead of expo-audio
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const API_BASE_URL = 'http://192.168.43.198:8000';

export default function App() {
  const camera = useRef(null);
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [sound, setSound] = useState();
  
  const [isRecording, setIsRecording] = useState(false);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [audioFile, setAudioFile] = useState(null);

  // Configure audio mode on component mount
  useEffect(() => {
    const setupAudio = async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    };
    
    setupAudio();
  }, []);

  // Clean up sound on unmount
  useEffect(() => {
    return sound
      ? () => {
          console.log('Unloading Sound');
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  // Request camera permissions
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const takePicture = async () => {
    if (camera.current) {
      try {
        setLoading(true);
        const photo = await camera.current.takePictureAsync({
          quality: 0.7,
          base64: false,
          skipProcessing: false,
        });

        console.log('Photo taken:', photo.uri);
        await uploadImage(photo.uri);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
        setLoading(false);
      }
    }
  };

  const uploadImage = async (imageUri) => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });

      console.log('Uploading image to:', `${API_BASE_URL}/caption`);
      const response = await axios.post(`${API_BASE_URL}/caption`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      console.log('Response received:', response.data);
      setCaption(response.data.caption);
      setAudioFile(response.data.audio_file);
      
      // Auto-play the audio
      if (response.data.audio_file) {
        await playAudio(response.data.audio_file);
      }

    } catch (error) {
      console.error('Upload error:', error);
      if (error.response) {
        Alert.alert('Server Error', `Server responded with status ${error.response.status}`);
      } else if (error.request) {
        Alert.alert(
          'Connection Error', 
          `Cannot connect to server at ${API_BASE_URL}. Make sure your server is running and accessible from this network.`
        );
      } else {
        Alert.alert('Error', `Failed to process image: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const playAudio = async (filename) => {
    try {
      const audioUrl = `${API_BASE_URL}/audio/${filename}`;
      console.log('Playing audio from:', audioUrl);

      // Stop any currently playing sound
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }

      // Load and play the new sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      
      setSound(newSound);

      // Optional: Add playback status listener
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          console.log('Audio finished playing');
        }
      });

    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Audio Error', 'Failed to play audio description. The audio file might be corrupted or inaccessible.');
    }
  };

  const stopAudio = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const startTracking = () => {
    setIsRecording(true);
    Alert.alert('Tracking Started', 'Face and motion tracking is now active');
  };

  const stopTracking = () => {
    setIsRecording(false);
    Alert.alert('Tracking Stopped', 'Face and motion tracking stopped');
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to use the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={camera}
        style={styles.camera}
        facing={facing}
        mode="picture"
        zoom={0}
      />
      
      <View style={styles.overlay}>
        {/* Camera Flip Button */}
        <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
          <Text style={styles.flipText}>🔄</Text>
        </TouchableOpacity>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.button, isRecording && styles.recordingButton]}
            onPress={isRecording ? stopTracking : startTracking}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {isRecording ? 'Stop' : 'Track'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.captureButton]}
            onPress={takePicture}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>📸</Text>
            )}
          </TouchableOpacity>

          {sound && (
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={stopAudio}
            >
              <Text style={styles.buttonText}>⏹️</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Results */}
        {caption ? (
          <View style={styles.resultContainer}>
            <Text style={styles.captionTitle}>AI Description:</Text>
            <Text style={styles.captionText}>{caption}</Text>
            
            <View style={styles.audioControls}>
              {audioFile && (
                <TouchableOpacity
                  style={styles.audioButton}
                  onPress={() => playAudio(audioFile)}
                >
                  <Text style={styles.audioButtonText}>🔊 Play Audio</Text>
                </TouchableOpacity>
              )}
              {sound && (
                <TouchableOpacity
                  style={[styles.audioButton, styles.stopAudioButton]}
                  onPress={stopAudio}
                >
                  <Text style={styles.audioButtonText}>⏹️ Stop</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>
              Tap the camera icon to capture and describe
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
  },
  flipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 15,
    borderRadius: 50,
  },
  flipText: {
    fontSize: 24,
    color: 'white',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  recordingButton: {
    backgroundColor: 'rgba(255,0,0,0.6)',
  },
  stopButton: {
    backgroundColor: 'rgba(255,100,0,0.6)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  captionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  captionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  audioControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  audioButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  stopAudioButton: {
    backgroundColor: '#f44336',
  },
  audioButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
    fontSize: 16,
  },
  instructionContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
});