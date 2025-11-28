import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Camera } from "expo-camera";
import { WebView } from "react-native-webview";

export default function CameraScreen() {
    const camRef = useRef(null);
    const webRef = useRef(null);
    const [permission, setPermission] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [webReady, setWebReady] = useState(false);
    const [objects, setObjects] = useState([]);
    const [cameraReady, setCameraReady] = useState(false);

    // Request camera permission
    useEffect(() => {
        let mounted = true;
        
        (async () => {
            try {
                const { status } = await Camera.requestCameraPermissionsAsync();
                if (mounted) {
                    setPermission(status === "granted");
                }
            } catch (error) {
                console.log("Permission error:", error);
                if (mounted) {
                    setPermission(false);
                }
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    // Continuous detection
    useEffect(() => {
        if (!permission || !webReady || !cameraReady) return;

        let intervalId;
        let mounted = true;

        const captureFrame = async () => {
            if (!mounted || !camRef.current || isProcessing) return;
            
            setIsProcessing(true);
            try {
                const photo = await camRef.current.takePictureAsync({
                    base64: true,
                    quality: 0.4,
                    skipProcessing: true,
                    exif: false
                });
                
                if (photo?.base64 && webRef.current) {
                    webRef.current.postMessage(JSON.stringify({ 
                        type: "FRAME", 
                        image: photo.base64 
                    }));
                }
            } catch (error) {
                console.log("Capture error:", error);
            } finally {
                if (mounted) {
                    setTimeout(() => setIsProcessing(false), 400);
                }
            }
        };

        intervalId = setInterval(captureFrame, 1000);

        return () => {
            mounted = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, [webReady, isProcessing, permission, cameraReady]);

    const onWebMessage = (event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "READY") {
                setWebReady(true);
            } else if (data.type === "DETECTIONS") {
                setObjects(data.objects || []);
            }
        } catch (error) {
            console.log("Web message error:", error);
        }
    };

    const onCameraReady = () => {
        setCameraReady(true);
    };

    // Permission states
    if (permission === null) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
                <Text>Requesting camera permission...</Text>
            </View>
        );
    }

    if (permission === false) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>Camera permission denied</Text>
                <Text style={styles.subText}>Please enable camera permissions in settings</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Camera 
                ref={camRef}
                style={styles.camera}
                type={Camera.Constants.Type.back}
                onCameraReady={onCameraReady}
                ratio="16:9"
            />

            {/* WebView for object detection */}
            <WebView
                ref={webRef}
                javaScriptEnabled={true}
                onMessage={onWebMessage}
                originWhitelist={["*"]}
                injectedJavaScript={injectedScript}
                source={{ html: baseHTML }}
                style={styles.hiddenWebView}
            />

            {/* Detection results overlay */}
            <View style={styles.overlay}>
                <Text style={styles.overlayTitle}>Detected Objects:</Text>
                <ScrollView style={styles.resultsContainer}>
                    {objects.length === 0 ? (
                        <Text style={styles.noObjects}>No objects detected</Text>
                    ) : (
                        objects.map((obj, index) => (
                            <Text key={index} style={styles.objectText}>
                                {obj.category} ({(obj.score * 100).toFixed(1)}%)
                            </Text>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* Status indicator */}
            <View style={styles.statusBar}>
                <Text style={styles.statusText}>
                    Status: {cameraReady && webReady ? "Ready" : "Loading..."}
                </Text>
            </View>
        </View>
    );
}

const baseHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <script>
        ${injectedScript}
    </script>
</body>
</html>
`;

const injectedScript = `
let detector = null;

// Notify React Native that WebView is ready
window.ReactNativeWebView.postMessage(JSON.stringify({ type: "READY" }));

// Load MediaPipe
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/vision_bundle.js';
script.onload = initializeDetector;
document.head.appendChild(script);

async function initializeDetector() {
  try {
    const vision = await Vision.create();
    const modelUrl = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
    
    detector = await vision.ObjectDetector.createFromOptions({
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate: "GPU"
      },
      runningMode: "IMAGE",
      maxResults: 5,
      scoreThreshold: 0.3
    });
    
    console.log('Detector ready');
  } catch (error) {
    console.error('Detector init error:', error);
  }
}

function handleMessage(event) {
  try {
    const data = JSON.parse(event.data);
    
    if (data.type === "FRAME" && data.image && detector) {
      processImage(data.image);
    }
  } catch (error) {
    console.error('Message handling error:', error);
  }
}

async function processImage(base64Image) {
  try {
    const img = new Image();
    img.onload = async function() {
      try {
        const detections = detector.detect(img);
        const objects = detections.detections.map(detection => ({
          category: detection.categories[0]?.categoryName || 'Unknown',
          score: detection.categories[0]?.score || 0
        }));
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: "DETECTIONS",
          objects: objects
        }));
      } catch (detectError) {
        console.error('Detection error:', detectError);
      }
    };
    
    img.onerror = function() {
      console.error('Image loading error');
    };
    
    img.src = "data:image/jpeg;base64," + base64Image;
  } catch (error) {
    console.error('Process image error:', error);
  }
}

// Set up message listeners
document.addEventListener('message', handleMessage);
window.addEventListener('message', handleMessage);
`;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black'
    },
    camera: {
        flex: 1,
    },
    hiddenWebView: {
        display: 'none',
        width: 0,
        height: 0
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5'
    },
    overlay: {
        position: 'absolute',
        top: 50,
        left: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 10,
        padding: 10,
        maxHeight: 200
    },
    overlayTitle: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5
    },
    resultsContainer: {
        maxHeight: 150
    },
    objectText: {
        color: 'yellow',
        fontSize: 14,
        fontWeight: 'bold',
        marginVertical: 2
    },
    noObjects: {
        color: '#ccc',
        fontSize: 14,
        fontStyle: 'italic'
    },
    errorText: {
        color: 'red',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10
    },
    subText: {
        color: '#666',
        fontSize: 14
    },
    statusBar: {
        position: 'absolute',
        bottom: 20,
        left: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 5
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        textAlign: 'center'
    }
});