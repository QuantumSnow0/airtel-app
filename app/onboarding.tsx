import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { markTutorialCompleted } from "../lib/tutorial";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Slide {
  id: number;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  minTime: number; // Minimum time in milliseconds
  features?: string[];
  image?: any; // Optional image source
}

const TUTORIAL_SLIDES: Slide[] = [
  {
    id: 1,
    title: "Welcome to Airtel Router",
    description:
      "Your powerful customer management and WhatsApp messaging platform. Let's get you started with a quick tour of all the amazing features.",
    icon: "rocket",
    color: "#FFD700",
    minTime: 3000,
    image: require("../assets/silder/slider1.png"),
  },
  {
    id: 2,
    title: "Secure Authentication",
    description:
      "Your data is protected with biometric authentication. Use your fingerprint or face ID for quick and secure access, with PIN fallback for reliability.",
    icon: "lock-closed",
    color: "#10B981",
    minTime: 4000,
    image: require("../assets/silder/slider2.png"),
    features: [
      "Biometric authentication",
      "PIN fallback option",
      "Secure data protection",
    ],
  },
  {
    id: 3,
    title: "Smart AI Automation",
    description:
      "Our AI automatically responds to customer messages, handling simple queries instantly and flagging complex issues for your review. All AI responses are clearly tagged.",
    icon: "sparkles",
    color: "#8B5CF6",
    minTime: 5000,
    image: require("../assets/silder/slider3.png"),
    features: [
      "Automatic message responses",
      "Smart intent detection",
      "AI-tagged responses",
      "Agent review for complex issues",
    ],
  },
  {
    id: 4,
    title: "Powerful Messages",
    description:
      "Manage all your customer conversations in one place. Search, filter, and organize with powerful tools designed for efficiency.",
    icon: "chatbubbles",
    color: "#3B82F6",
    minTime: 4000,
    features: [
      "Real-time message sync",
      "Advanced search",
      "Smart filters",
      "Unread indicators",
    ],
  },
  {
    id: 5,
    title: "Pin Important Conversations",
    description:
      "Keep your most important customers at the top. Long-press any conversation to pin it, ensuring quick access to VIP clients and urgent matters.",
    icon: "pin",
    color: "#F59E0B",
    minTime: 4000,
    features: [
      "Long-press to pin",
      "Pinned conversations stay on top",
      "Quick access to VIPs",
    ],
  },
  {
    id: 6,
    title: "Quick Reply Templates",
    description:
      "Respond faster with pre-built quick reply templates. Tap a template to insert it, edit if needed, and send. Perfect for common responses.",
    icon: "flash",
    color: "#EF4444",
    minTime: 4000,
    features: [
      "5 pre-built templates",
      "One-tap insertion",
      "Editable before sending",
      "Time-saving responses",
    ],
  },
  {
    id: 7,
    title: "Enhanced Chat Experience",
    description:
      "Enjoy a seamless messaging experience with date separators, scroll-to-bottom button, message copy, and smooth animations throughout.",
    icon: "chatbubble-ellipses",
    color: "#06B6D4",
    minTime: 4500,
    features: [
      "Date separators",
      "Scroll to bottom",
      "Copy messages",
      "Smooth animations",
    ],
  },
  {
    id: 8,
    title: "Batch Operations",
    description:
      "Send messages to multiple customers at once. Select multiple conversations and send template messages in bulk, saving you valuable time.",
    icon: "send",
    color: "#EC4899",
    minTime: 4000,
    features: [
      "Multi-select conversations",
      "Batch message sending",
      "Progress tracking",
      "Efficient workflows",
    ],
  },
  {
    id: 9,
    title: "Real-Time Notifications",
    description:
      "Stay updated instantly! Get notified whenever a new customer signs up today. Never miss a new registration with real-time alerts.",
    icon: "notifications",
    color: "#F59E0B",
    minTime: 4000,
    features: [
      "Instant notifications",
      "New customer alerts",
      "Works in background",
      "Today's registrations only",
    ],
  },
  {
    id: 10,
    title: "You're All Set!",
    description:
      "You now know all the key features. Start managing your customers and conversations with confidence. Happy messaging!",
    icon: "checkmark-circle",
    color: "#10B981",
    minTime: 3000,
  },
];

export default function OnboardingScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [canProceed, setCanProceed] = useState(false);
  const [slideStartTime, setSlideStartTime] = useState(Date.now());
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const isGoingBackRef = useRef(false);


  useEffect(() => {
    // If going backward, allow immediate navigation
    if (isGoingBackRef.current) {
      isGoingBackRef.current = false; // Reset flag
      setCanProceed(true);
      return;
    }

    // Going forward - enforce minimum viewing time
    setCanProceed(false);
    setSlideStartTime(Date.now());

    // Enable proceed after minimum time
    const minTime = TUTORIAL_SLIDES[currentSlide].minTime;
    const timer = setTimeout(() => {
      setCanProceed(true);
    }, minTime);

    return () => clearTimeout(timer);
  }, [currentSlide]);

  const handleNext = () => {
    if (!canProceed) return;

    // Mark that we're going forward
    isGoingBackRef.current = false;

    if (currentSlide < TUTORIAL_SLIDES.length - 1) {
      // Fade animation
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const nextSlide = currentSlide + 1;
      setCurrentSlide(nextSlide);
      scrollViewRef.current?.scrollTo({
        x: nextSlide * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      // Mark that we're going backward
      isGoingBackRef.current = true;

      // Fade animation
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const prevSlide = currentSlide - 1;
      setCurrentSlide(prevSlide);
      scrollViewRef.current?.scrollTo({
        x: prevSlide * SCREEN_WIDTH,
        animated: true,
      });
    }
  };

  // Handle scroll to update current slide
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const slideIndex = Math.round(offsetX / SCREEN_WIDTH);

    if (
      slideIndex !== currentSlide &&
      slideIndex >= 0 &&
      slideIndex < TUTORIAL_SLIDES.length
    ) {
      // Track if going backward
      isGoingBackRef.current = slideIndex < currentSlide;
      setCurrentSlide(slideIndex);
    }
  };

  const handleComplete = async () => {
    try {
      await markTutorialCompleted();
      router.replace("/(tabs)/home");
    } catch (error) {
      console.error("Error saving tutorial status:", error);
      router.replace("/(tabs)/home");
    }
  };

  const renderSlide = (slide: Slide, index: number) => {
    const isActive = index === currentSlide;
    // Slide 3 (AI Automation) uses full width for horizontal composition
    const isFullWidth = slide.id === 3;
    const imageSize = isFullWidth
      ? SCREEN_WIDTH * 0.9
      : Math.min(SCREEN_WIDTH * 0.6, SCREEN_HEIGHT * 0.4);
    const imageHeight = isFullWidth ? SCREEN_HEIGHT * 0.3 : imageSize;
    // Push images down for slides 2 and 3 to match slide 1 position
    const needsOffset = slide.id === 2 || slide.id === 3;

    return (
      <View key={slide.id} style={styles.slide}>
        {slide.image ? (
          <View
            style={[
              styles.imageContainer,
              {
                width: imageSize,
                height: imageHeight,
                marginTop: needsOffset ? 20 : 0,
              },
            ]}
          >
            <Image
              source={slide.image}
              style={styles.slideImage}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={[styles.iconContainer, { marginTop: 20 }]}>
            <Ionicons name={slide.icon} size={80} color={slide.color} />
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.description}</Text>

          {slide.features && slide.features.length > 0 && (
            <View style={styles.featuresContainer}>
              {slide.features.map((feature, idx) => (
                <View key={idx} style={styles.featureItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={slide.color}
                  />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const currentSlideData = TUTORIAL_SLIDES[currentSlide];
  const isLastSlide = currentSlide === TUTORIAL_SLIDES.length - 1;
  const progress = ((currentSlide + 1) / TUTORIAL_SLIDES.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: `${progress}%`,
                backgroundColor: currentSlideData.color,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {currentSlide + 1} / {TUTORIAL_SLIDES.length}
        </Text>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="center"
      >
        {TUTORIAL_SLIDES.map((slide, index) => renderSlide(slide, index))}
      </ScrollView>

      {/* Navigation */}
      <Animated.View style={[styles.navigation, { opacity: fadeAnim }]}>
        <View style={styles.dotsContainer}>
          {TUTORIAL_SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentSlide && [
                  styles.dotActive,
                  { backgroundColor: currentSlideData.color },
                ],
              ]}
            />
          ))}
        </View>

        <View style={styles.buttonContainer}>
          {/* Previous Button */}
          {currentSlide > 0 && (
            <TouchableOpacity
              style={styles.previousButton}
              onPress={handlePrevious}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-back"
                size={20}
                color="#FFFFFF"
                style={styles.previousButtonIcon}
              />
              <Text style={styles.previousButtonText}>Previous</Text>
            </TouchableOpacity>
          )}

          {/* Next Button */}
          <TouchableOpacity
            style={[
              styles.nextButton,
              !canProceed && styles.nextButtonDisabled,
              {
                backgroundColor: canProceed
                  ? currentSlideData.color
                  : "#6B7280",
              },
              currentSlide === 0 && styles.nextButtonFullWidth,
            ]}
            onPress={handleNext}
            disabled={!canProceed}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>
              {isLastSlide ? "Get Started" : "Next"}
            </Text>
            <Ionicons
              name={isLastSlide ? "checkmark" : "arrow-forward"}
              size={20}
              color="#FFFFFF"
              style={styles.nextButtonIcon}
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#1F1F1F",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textAlign: "right",
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 120,
  },
  iconContainer: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  imageContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  slideImage: {
    width: "100%",
    height: "100%",
  },
  content: {
    alignItems: "center",
    width: "100%",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  featuresContainer: {
    width: "100%",
    marginTop: 8,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  featureText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#E5E7EB",
    marginLeft: 12,
    flex: 1,
  },
  navigation: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    paddingTop: 20,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2A2A2A",
  },
  dotActive: {
    width: 24,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  previousButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#3A3A3A",
    gap: 8,
    flex: 1,
  },
  previousButtonIcon: {
    marginRight: -4,
  },
  previousButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 8,
    flex: 1,
  },
  nextButtonFullWidth: {
    flex: 1,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  nextButtonIcon: {
    marginLeft: 4,
  },
});
